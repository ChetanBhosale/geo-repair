import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import Secrets from "@repo/secrets/backend";
import type {
  BillingHistoryResponse,
  BillingInvoice,
  BillingInvoiceDetail,
  BillingOrder,
  OrderSummary,
  SiteReport,
} from "@repo/types";

import { normalizeWebsite } from "../lib/url";
import {
  createDodoCheckoutSession,
  retrieveDodoPayment,
  type DodoWebhookHeaders,
  type DodoWebhookPayload,
  unwrapDodoWebhook,
} from "./providers/dodo";

type FixTier = "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE_CUSTOM";
type OrderStatus =
  | "PENDING"
  | "CHECKOUT_CREATED"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "CANCELED"
  | "REFUNDED"
  | "DISPUTED";

type FixTierConfig = {
  tier: FixTier;
  amountCents: number;
  productId?: string;
};

type GatedOrder = Prisma.OrderGetPayload<{ include: { user: true } }>;

const FIX_TIER_RANK: Record<FixTier, number> = {
  STARTER: 0,
  GROWTH: 1,
  SCALE: 2,
  ENTERPRISE_CUSTOM: 3,
};

export class BillingError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export function getFixTierForPageCount(pageCount: number): FixTierConfig {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new BillingError(400, "sitemapPageCount must be a positive integer.");
  }

  if (pageCount <= 25) {
    return {
      tier: "STARTER",
      amountCents: 4900,
      productId: Secrets.DODO_PRODUCT_ID_STARTER,
    };
  }

  if (pageCount <= 100) {
    return {
      tier: "GROWTH",
      amountCents: 14900,
      productId: Secrets.DODO_PRODUCT_ID_GROWTH,
    };
  }

  if (pageCount <= 250) {
    return {
      tier: "SCALE",
      amountCents: 39900,
      productId: Secrets.DODO_PRODUCT_ID_SCALE,
    };
  }

  return { tier: "ENTERPRISE_CUSTOM", amountCents: 0 };
}

export function getFixTierByName(tier: FixTier): FixTierConfig {
  switch (tier) {
    case "STARTER":
      return {
        tier: "STARTER",
        amountCents: 4900,
        productId: Secrets.DODO_PRODUCT_ID_STARTER,
      };
    case "GROWTH":
      return {
        tier: "GROWTH",
        amountCents: 14900,
        productId: Secrets.DODO_PRODUCT_ID_GROWTH,
      };
    case "SCALE":
      return {
        tier: "SCALE",
        amountCents: 39900,
        productId: Secrets.DODO_PRODUCT_ID_SCALE,
      };
    case "ENTERPRISE_CUSTOM":
      return { tier: "ENTERPRISE_CUSTOM", amountCents: 0 };
  }
}

export function getFixTierForSelection(
  sitemapPageCount: number,
  selectedTier?: FixTier,
): FixTierConfig {
  const applicableTier = getFixTierForPageCount(sitemapPageCount);
  const requestedTier = selectedTier
    ? getFixTierByName(selectedTier)
    : applicableTier;

  if (FIX_TIER_RANK[requestedTier.tier] < FIX_TIER_RANK[applicableTier.tier]) {
    throw new BillingError(
      400,
      "Selected tier cannot be lower than the tier required by the scan.",
    );
  }

  return requestedTier;
}

function requireProductId(tier: FixTierConfig): string {
  if (tier.tier === "ENTERPRISE_CUSTOM") {
    throw new BillingError(400, "Custom plans require a sales conversation.");
  }

  if (!tier.productId) {
    throw new BillingError(
      500,
      `Missing Dodo product id for ${tier.tier.toLowerCase()} tier.`,
    );
  }

  return tier.productId;
}

function checkoutReturnUrl(orderId: string): string {
  return `${Secrets.WEB_URL.replace(/\/+$/, "")}/checkout/return?order_id=${encodeURIComponent(orderId)}`;
}

function orderSummary(order: {
  id: string;
  status: OrderStatus;
  tier: FixTier;
  amountCents: number;
  currency: string;
  website: string;
  repoFullName: string | null;
  checkoutUrl: string | null;
}): OrderSummary {
  return {
    id: order.id,
    status: order.status,
    tier: order.tier,
    amountCents: order.amountCents,
    currency: order.currency,
    website: order.website,
    repoFullName: order.repoFullName,
    checkoutUrl: order.checkoutUrl,
    startFixUnlocked: order.status === "PAID",
  };
}

function invoiceId(orderId: string): string {
  return `INV-${orderId.slice(-8).toUpperCase()}`;
}

function invoiceDownloadPath(orderId: string): string {
  return `/api/billing/invoices/${encodeURIComponent(orderId)}/download`;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function billingDescription(order: {
  tier: FixTier;
  sitemapPageCount: number;
}): string {
  const label = order.tier
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return `${label} one-time AI Search fix, up to ${order.sitemapPageCount} pages`;
}

function toBillingOrder(order: {
  id: string;
  status: OrderStatus;
  tier: FixTier;
  amountCents: number;
  currency: string;
  website: string;
  repoFullName: string | null;
  provider: "DODO";
  providerPaymentId: string | null;
  providerSessionId: string | null;
  paidAt: Date | null;
  failedAt: Date | null;
  canceledAt: Date | null;
  refundedAt: Date | null;
  disputedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): BillingOrder {
  return {
    id: order.id,
    status: order.status,
    tier: order.tier,
    amountCents: order.amountCents,
    currency: order.currency,
    website: order.website,
    repoFullName: order.repoFullName,
    provider: order.provider,
    providerPaymentId: order.providerPaymentId,
    providerSessionId: order.providerSessionId,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    failedAt: order.failedAt?.toISOString() ?? null,
    canceledAt: order.canceledAt?.toISOString() ?? null,
    refundedAt: order.refundedAt?.toISOString() ?? null,
    disputedAt: order.disputedAt?.toISOString() ?? null,
  };
}

function toBillingInvoice(order: {
  id: string;
  status: OrderStatus;
  tier: FixTier;
  amountCents: number;
  currency: string;
  website: string;
  repoFullName: string | null;
  providerPaymentId: string | null;
  sitemapPageCount: number;
  paidAt: Date | null;
  createdAt: Date;
}): BillingInvoice {
  return {
    id: invoiceId(order.id),
    orderId: order.id,
    status: order.status,
    amountCents: order.amountCents,
    currency: order.currency,
    description: billingDescription(order),
    website: order.website,
    repoFullName: order.repoFullName,
    issuedAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    providerPaymentId: order.providerPaymentId,
    downloadUrl: invoiceDownloadPath(order.id),
  };
}

function orderSelect() {
  return {
    id: true,
    status: true,
    tier: true,
    amountCents: true,
    currency: true,
    sitemapPageCount: true,
    website: true,
    repoFullName: true,
    provider: true,
    providerPaymentId: true,
    providerSessionId: true,
    paidAt: true,
    failedAt: true,
    canceledAt: true,
    refundedAt: true,
    disputedAt: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.OrderSelect;
}

function metadataForOrder(order: {
  id: string;
  tier: FixTier;
  amountCents: number;
  currency: string;
  website: string;
  repoFullName: string | null;
  providerProductId: string;
}): Record<string, string> {
  return {
    order_id: order.id,
    tier: order.tier,
    amount_cents: String(order.amountCents),
    currency: order.currency,
    website: order.website,
    provider_product_id: order.providerProductId,
    ...(order.repoFullName ? { repo_full_name: order.repoFullName } : {}),
  };
}

function siteReportFromJson(value: Prisma.JsonValue | null): SiteReport | null {
  if (!value) return null;

  const parsed =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })()
      : value;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const report = parsed as Partial<SiteReport>;
  return report.crawl && typeof report.crawl.pagesChecked === "number"
    ? (report as SiteReport)
    : null;
}

function pageCountForReport(reportData: Prisma.JsonValue | null): number {
  const report = siteReportFromJson(reportData);
  return Math.max(1, Math.round(report?.crawl.pagesChecked ?? 25));
}

export async function getOrderById(
  orderId: string,
): Promise<OrderSummary | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      tier: true,
      amountCents: true,
      currency: true,
      website: true,
      repoFullName: true,
      checkoutUrl: true,
    },
  });

  return order ? orderSummary(order) : null;
}

export async function listBillingHistoryForUser(
  userId: string,
): Promise<BillingHistoryResponse> {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: orderSelect(),
  });

  return {
    orders: orders.map(toBillingOrder),
    invoices: orders.map(toBillingInvoice),
  };
}

export async function getInvoiceForUser(
  userId: string,
  orderId: string,
): Promise<BillingInvoiceDetail | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      ...orderSelect(),
      user: { select: { email: true } },
    },
  });

  if (!order) return null;

  return {
    ...toBillingInvoice(order),
    customerEmail: order.user?.email ?? null,
    lineItems: [
      {
        label: billingDescription(order),
        quantity: 1,
        amountCents: order.amountCents,
      },
    ],
  };
}

export function renderInvoiceMarkdown(invoice: BillingInvoiceDetail): string {
  const lines = [
    `# Invoice ${invoice.id}`,
    "",
    `Status: ${invoice.status.toLowerCase().replaceAll("_", " ")}`,
    `Issued: ${invoice.issuedAt}`,
    `Paid: ${invoice.paidAt ?? "Not paid"}`,
    `Customer: ${invoice.customerEmail ?? "Not available"}`,
    `Website: ${invoice.website}`,
    `Repository: ${invoice.repoFullName ?? "Not selected"}`,
    `Payment ID: ${invoice.providerPaymentId ?? "Not available"}`,
    "",
    "## Line items",
    "",
  ];

  for (const item of invoice.lineItems) {
    lines.push(
      `- ${item.label} x ${item.quantity}: ${formatMoney(item.amountCents, invoice.currency)}`,
    );
  }

  lines.push(
    "",
    `Total: ${formatMoney(invoice.amountCents, invoice.currency)}`,
    "",
    "Generated by geo.repair billing records.",
  );

  return `${lines.join("\n").trim()}\n`;
}

export function invoiceDownloadFilename(invoice: BillingInvoiceDetail): string {
  return `${invoice.id.toLowerCase()}.md`;
}

export async function createFixCheckoutForOrder(input: {
  orderId: string;
  userId: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { user: true },
  });

  if (!order) {
    throw new BillingError(404, "Order not found.");
  }

  if (!order.userId || order.userId !== input.userId) {
    throw new BillingError(403, "You do not have access to this order.");
  }

  return createCheckoutForGatedOrder(order);
}

export async function createFixCheckoutForSelection(input: {
  userId: string;
  repositoryId: string;
  checkupReportKey: string;
  selectedTier?: FixTier;
}) {
  const [repo, report] = await Promise.all([
    prisma.repository.findFirst({
      where: { id: input.repositoryId, userId: input.userId },
    }),
    prisma.checkupReport.findUnique({
      where: { id: input.checkupReportKey },
    }),
  ]);

  if (!repo) {
    throw new BillingError(404, "Repository not found for this user.");
  }
  if (!report) {
    throw new BillingError(404, "Checkup report not found.");
  }

  const sitemapPageCount = pageCountForReport(report.reportData);
  const tier = getFixTierForSelection(sitemapPageCount, input.selectedTier);

  const existing = await prisma.order.findFirst({
    where: {
      userId: input.userId,
      checkupReportId: report.id,
      repoFullName: repo.fullName,
      website: report.website,
      tier: tier.tier,
      status: { in: ["PENDING", "CHECKOUT_CREATED", "PROCESSING", "PAID"] },
    },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return createCheckoutForGatedOrder(existing);
  }

  const productId = requireProductId(tier);

  const order = await prisma.order.create({
    data: {
      userId: input.userId,
      checkupReportId: report.id,
      tier: tier.tier,
      amountCents: tier.amountCents,
      sitemapPageCount,
      website: report.website,
      repoFullName: repo.fullName,
      repoConfirmed: true,
      feasibilityPassed: true,
      providerProductId: productId,
    },
    include: { user: true },
  });

  return createCheckoutForGatedOrder(order);
}

export async function getPaidFixOrderForUser(input: {
  orderId: string;
  userId: string;
}) {
  return prisma.order.findFirst({
    where: {
      id: input.orderId,
      userId: input.userId,
      status: "PAID",
    },
  });
}

function assertDodoPaymentMatchesOrder(
  payment: Awaited<ReturnType<typeof retrieveDodoPayment>>,
  order: GatedOrder,
): void {
  if (payment.status !== "succeeded") {
    throw new BillingError(409, "Dodo payment is not marked succeeded.");
  }

  if (
    payment.payment_id !== order.providerPaymentId &&
    order.providerPaymentId
  ) {
    throw new BillingError(409, "Dodo payment id does not match this order.");
  }

  if (
    payment.checkout_session_id &&
    order.providerSessionId &&
    payment.checkout_session_id !== order.providerSessionId
  ) {
    throw new BillingError(
      409,
      "Dodo checkout session does not match this order.",
    );
  }

  if (payment.metadata.order_id && payment.metadata.order_id !== order.id) {
    throw new BillingError(409, "Dodo payment metadata order mismatch.");
  }

  if (
    payment.metadata.provider_product_id &&
    payment.metadata.provider_product_id !== order.providerProductId
  ) {
    throw new BillingError(409, "Dodo payment product metadata mismatch.");
  }

  if (
    payment.metadata.amount_cents &&
    payment.metadata.amount_cents !== String(order.amountCents)
  ) {
    throw new BillingError(409, "Dodo payment amount metadata mismatch.");
  }

  if (
    payment.metadata.currency &&
    payment.metadata.currency.toUpperCase() !== order.currency.toUpperCase()
  ) {
    throw new BillingError(409, "Dodo payment currency metadata mismatch.");
  }

  if (
    payment.currency.toUpperCase() === order.currency.toUpperCase() &&
    payment.total_amount !== order.amountCents
  ) {
    throw new BillingError(409, "Dodo payment amount does not match order.");
  }

  const productIds = payment.product_cart?.map((item) => item.product_id) ?? [];
  if (productIds.length > 0 && !productIds.includes(order.providerProductId)) {
    throw new BillingError(409, "Dodo payment product does not match order.");
  }
}

export async function reconcileFixCheckoutReturn(input: {
  orderId: string;
  paymentId: string;
  status?: string;
}) {
  if (input.status && input.status !== "succeeded") {
    throw new BillingError(409, "Checkout return is not a succeeded payment.");
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { user: true },
  });

  if (!order) {
    throw new BillingError(404, "Order not found.");
  }

  const existingPaymentOrder = await prisma.order.findUnique({
    where: { providerPaymentId: input.paymentId },
    select: { id: true },
  });

  if (existingPaymentOrder && existingPaymentOrder.id !== order.id) {
    throw new BillingError(
      409,
      "Dodo payment is already linked to another order.",
    );
  }

  if (order.status === "PAID") {
    return { order: orderSummary(order) };
  }

  const payment = await retrieveDodoPayment(input.paymentId);
  assertDodoPaymentMatchesOrder(payment, order);

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      providerPaymentId: payment.payment_id,
      providerSessionId: payment.checkout_session_id ?? order.providerSessionId,
      providerCustomerId:
        payment.customer.customer_id ?? order.providerCustomerId,
    },
  });

  await prisma.paymentWebhookEvent.upsert({
    where: {
      provider_providerEventId: {
        provider: "DODO",
        providerEventId: `return:${payment.payment_id}`,
      },
    },
    create: {
      provider: "DODO",
      providerEventId: `return:${payment.payment_id}`,
      eventType: "payment.return_reconciled",
      processingStatus: "PROCESSED",
      providerPaymentId: payment.payment_id,
      orderId: order.id,
      rawPayload: payment as unknown as Prisma.InputJsonValue,
      processedAt: new Date(),
    },
    update: {
      processingStatus: "PROCESSED",
      orderId: order.id,
      rawPayload: payment as unknown as Prisma.InputJsonValue,
      processedAt: new Date(),
    },
  });

  return { order: orderSummary(updated) };
}

async function createCheckoutForGatedOrder(order: GatedOrder) {
  if (!order.repoConfirmed || !order.feasibilityPassed) {
    throw new BillingError(
      409,
      "Checkout is locked until repo confirmation and feasibility pass.",
    );
  }

  if (order.tier === "ENTERPRISE_CUSTOM") {
    throw new BillingError(400, "Custom plans require a sales conversation.");
  }

  if (order.status === "PAID") {
    return { order: orderSummary(order), checkoutUrl: null };
  }

  if (order.status === "CHECKOUT_CREATED" && order.checkoutUrl) {
    return { order: orderSummary(order), checkoutUrl: order.checkoutUrl };
  }

  const session = await createDodoCheckoutSession({
    orderId: order.id,
    productId: order.providerProductId,
    customer: {
      email: order.user?.email,
      name: order.user?.name,
    },
    returnUrl: checkoutReturnUrl(order.id),
    cancelUrl: checkoutReturnUrl(order.id),
    metadata: metadataForOrder(order),
  });

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "CHECKOUT_CREATED",
      checkoutUrl: session.checkoutUrl,
      providerSessionId: session.sessionId,
      providerPaymentId: session.paymentId,
    },
  });

  return { order: orderSummary(updated), checkoutUrl: session.checkoutUrl };
}

export async function createDevFixtureOrder(input: {
  website?: string;
  email?: string;
  name?: string;
  repoFullName?: string;
  sitemapPageCount?: number;
}) {
  if (
    !Secrets.ENABLE_DEV_BILLING_FIXTURES ||
    Secrets.NODE_ENV === "production"
  ) {
    throw new BillingError(404, "Dev billing fixtures are disabled.");
  }

  const website = normalizeWebsite(input.website ?? "https://example.com");
  if (!website) {
    throw new BillingError(400, "A valid website URL is required.");
  }

  const sitemapPageCount = input.sitemapPageCount ?? 25;
  const tier = getFixTierForPageCount(sitemapPageCount);
  const productId = requireProductId(tier);
  const email = input.email ?? "dev-billing@geo.repair";

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: input.name ?? "Local Billing Tester",
    },
    create: {
      email,
      name: input.name ?? "Local Billing Tester",
      username: "local-billing-tester",
    },
  });

  const report = await prisma.checkupReport.upsert({
    where: { website },
    update: {},
    create: {
      website,
      websiteType: "custom",
      reportData: { devFixture: true },
      totalCheckupCount: 1,
    },
  });

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      checkupReportId: report.id,
      tier: tier.tier,
      amountCents: tier.amountCents,
      sitemapPageCount,
      website,
      repoFullName: input.repoFullName ?? "local/example-site",
      repoConfirmed: true,
      feasibilityPassed: true,
      providerProductId: productId,
    },
    include: { user: true },
  });

  return createCheckoutForGatedOrder(order);
}

function eventPaymentData(payload: DodoWebhookPayload) {
  return payload.data ?? {};
}

function eventMetadata(payload: DodoWebhookPayload): Record<string, string> {
  return eventPaymentData(payload).metadata ?? {};
}

function eventPaymentId(payload: DodoWebhookPayload): string | null {
  const data = eventPaymentData(payload);
  return data.payment_id ?? data.payment?.payment_id ?? null;
}

function assertMetadataMatchesOrder(
  payload: DodoWebhookPayload,
  order: {
    id: string;
    tier: FixTier;
    amountCents: number;
    currency: string;
    providerProductId: string;
  },
): void {
  const metadata = eventMetadata(payload);
  const expected: Record<string, string> = {
    order_id: order.id,
    tier: order.tier,
    amount_cents: String(order.amountCents),
    currency: order.currency,
    provider_product_id: order.providerProductId,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (metadata[key] && metadata[key] !== value) {
      throw new BillingError(422, `Dodo webhook ${key} mismatch.`);
    }
  }
}

async function findOrderForWebhook(payload: DodoWebhookPayload) {
  const metadata = eventMetadata(payload);
  const paymentId = eventPaymentId(payload);
  const sessionId = eventPaymentData(payload).checkout_session_id ?? null;

  if (metadata.order_id) {
    return prisma.order.findUnique({ where: { id: metadata.order_id } });
  }

  if (paymentId) {
    const byPayment = await prisma.order.findUnique({
      where: { providerPaymentId: paymentId },
    });
    if (byPayment) return byPayment;
  }

  if (sessionId) {
    return prisma.order.findUnique({ where: { providerSessionId: sessionId } });
  }

  return null;
}

function statusUpdateForEvent(payload: DodoWebhookPayload) {
  const now = new Date();

  switch (payload.type) {
    case "payment.succeeded":
      return { status: "PAID" as const, paidAt: now };
    case "payment.processing":
      return { status: "PROCESSING" as const };
    case "payment.failed":
      return { status: "FAILED" as const, failedAt: now };
    case "payment.cancelled":
      return { status: "CANCELED" as const, canceledAt: now };
    case "refund.succeeded":
      return {
        status: "REFUNDED" as const,
        resolutionState: "REFUNDED" as const,
        refundedAt: now,
      };
    case "dispute.opened":
    case "dispute.accepted":
    case "dispute.challenged":
    case "dispute.lost":
      return {
        status: "DISPUTED" as const,
        resolutionState: "SUPPORT_REQUIRED" as const,
        disputedAt: now,
      };
    default:
      return null;
  }
}

export async function processDodoWebhook(input: {
  rawBody: string;
  headers: DodoWebhookHeaders;
}) {
  const payload = unwrapDodoWebhook(input.rawBody, input.headers);
  const providerEventId = input.headers["webhook-id"];

  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider: "DODO",
        providerEventId,
      },
    },
  });

  if (existing) {
    return { duplicate: true, eventType: existing.eventType };
  }

  const paymentId = eventPaymentId(payload);
  const webhookEvent = await prisma.paymentWebhookEvent.create({
    data: {
      provider: "DODO",
      providerEventId,
      eventType: payload.type,
      providerPaymentId: paymentId,
      rawPayload: payload as Prisma.InputJsonValue,
    },
  });

  try {
    const order = await findOrderForWebhook(payload);
    const update = statusUpdateForEvent(payload);

    if (order && update) {
      if (payload.type === "payment.succeeded") {
        assertMetadataMatchesOrder(payload, order);
      }

      const canMutate =
        order.status !== "PAID" ||
        payload.type.startsWith("refund.") ||
        payload.type.startsWith("dispute.");

      if (canMutate) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            ...update,
            providerPaymentId: paymentId ?? order.providerPaymentId,
            providerSessionId:
              eventPaymentData(payload).checkout_session_id ??
              order.providerSessionId,
            providerCustomerId:
              eventPaymentData(payload).customer?.customer_id ??
              order.providerCustomerId,
          },
        });
      }

      await prisma.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          orderId: order.id,
          processingStatus: "PROCESSED",
          processedAt: new Date(),
        },
      });
    } else {
      await prisma.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          orderId: order?.id,
          processingStatus: "PROCESSED",
          processedAt: new Date(),
        },
      });
    }

    return { duplicate: false, eventType: payload.type };
  } catch (err) {
    await prisma.paymentWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: {
        processingStatus: "FAILED",
        error: err instanceof Error ? err.message : String(err),
      },
    });

    throw err;
  }
}
