import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import Secrets from "@repo/secrets/backend";
import type {
  BillingHistoryResponse,
  BillingOrder,
  ListPlansResponse,
  OrderSummary,
} from "@repo/types/billing";
import {
  CHAT_MESSAGE_LIMIT,
  FIX_ATTEMPT_LIMIT,
} from "@repo/types/entitlements";

import { getTemporalClient } from "../temporal/client";
import {
  BillingError,
  getFixTierForPageCount,
  getFixTierForSelection,
  planSummaries,
  requireProductId,
  type FixTierConfig,
} from "./billing-tiers";
import {
  createDodoCheckoutSession,
  retrieveDodoPayment,
  type DodoWebhookHeaders,
  type DodoWebhookPayload,
  unwrapDodoWebhook,
} from "./providers/dodo";

export { BillingError };

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

type OrderForCheckout = Prisma.OrderGetPayload<{ include: { user: true } }>;

type DodoPayment = Awaited<ReturnType<typeof retrieveDodoPayment>> & {
  status?: string | null;
  payment_id?: string | null;
  checkout_session_id?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
  customer?: { customer_id?: string | null } | null;
  product_cart?: { product_id?: string | null }[] | null;
};

function checkoutReturnUrl(orderId: string): string {
  return `${Secrets.WEB_URL.replace(/\/+$/, "")}/checkout/return?order_id=${encodeURIComponent(orderId)}`;
}

function normalizeWebsite(value: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;
    const parsed = new URL(withProtocol);
    if (!parsed.hostname.includes(".")) return null;
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function orderSummary(order: {
  id: string;
  status: OrderStatus;
  tier: FixTier;
  amountCents: number;
  currency: string;
  website: string;
  projectId: string | null;
  repoFullName: string | null;
  checkoutUrl: string | null;
  fixAttemptsUsed: number;
  chatMessagesUsed: number;
}): OrderSummary {
  return {
    id: order.id,
    status: order.status,
    tier: order.tier,
    amountCents: order.amountCents,
    currency: order.currency,
    website: order.website,
    projectId: order.projectId,
    repoFullName: order.repoFullName,
    checkoutUrl: order.checkoutUrl,
    startFixUnlocked: order.status === "PAID",
    fixAttemptsUsed: order.fixAttemptsUsed,
    fixAttemptLimit: FIX_ATTEMPT_LIMIT,
    chatMessagesUsed: order.chatMessagesUsed,
    chatMessageLimit: CHAT_MESSAGE_LIMIT,
  };
}

function publicOrderSummary(order: {
  id: string;
  status: OrderStatus;
  tier: FixTier;
  amountCents: number;
  currency: string;
  website: string;
  projectId: string | null;
  repoFullName: string | null;
  checkoutUrl: string | null;
  fixAttemptsUsed: number;
  chatMessagesUsed: number;
}): OrderSummary {
  return {
    ...orderSummary(order),
    website: "",
    projectId: null,
    repoFullName: null,
    checkoutUrl: null,
  };
}

function toBillingOrder(order: {
  id: string;
  status: OrderStatus;
  tier: FixTier;
  amountCents: number;
  currency: string;
  website: string;
  projectId: string | null;
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
  fixAttemptsUsed: number;
  chatMessagesUsed: number;
}): BillingOrder {
  return {
    id: order.id,
    status: order.status,
    tier: order.tier,
    amountCents: order.amountCents,
    currency: order.currency,
    website: order.website,
    projectId: order.projectId,
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
    fixAttemptsUsed: order.fixAttemptsUsed,
    fixAttemptLimit: FIX_ATTEMPT_LIMIT,
    chatMessagesUsed: order.chatMessagesUsed,
    chatMessageLimit: CHAT_MESSAGE_LIMIT,
  };
}

function planDetails(tier: FixTierConfig): Prisma.InputJsonValue {
  return {
    pageCover: tier.maxPages ? `Up to ${tier.maxPages} pages` : "250+ pages",
    description: tier.description,
    features: tier.features,
    selfServe: tier.selfServe,
  };
}

async function ensurePlan(tier: FixTierConfig) {
  return prisma.plan.upsert({
    where: { tier: tier.tier },
    create: {
      tier: tier.tier,
      name: tier.name,
      maxPages: tier.maxPages,
      amountCents: tier.amountCents,
      currency: tier.currency,
      providerProductId: tier.productId,
      details: planDetails(tier),
      sortOrder: tier.sortOrder,
      active: true,
    },
    update: {
      name: tier.name,
      maxPages: tier.maxPages,
      amountCents: tier.amountCents,
      currency: tier.currency,
      providerProductId: tier.productId,
      details: planDetails(tier),
      sortOrder: tier.sortOrder,
      active: true,
    },
  });
}

function metadataForOrder(order: {
  id: string;
  tier: FixTier;
  amountCents: number;
  currency: string;
  website: string;
  projectId: string | null;
  scrapingId: string | null;
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
    ...(order.projectId ? { project_id: order.projectId } : {}),
    ...(order.scrapingId ? { scraping_id: order.scrapingId } : {}),
    ...(order.repoFullName ? { repo_full_name: order.repoFullName } : {}),
  };
}

function readPagesFromResult(value: Prisma.JsonValue | null): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const crawl = (value as { crawl?: { pagesChecked?: unknown } }).crawl;
  return typeof crawl?.pagesChecked === "number" ? crawl.pagesChecked : null;
}

async function latestCompletedScraping(projectId: string, userId: string) {
  return prisma.scraping.findFirst({
    where: { projectId, userId, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
  });
}

function pageCountForScraping(scraping: {
  pagesChecked: number;
  result: Prisma.JsonValue | null;
}): number {
  return Math.max(
    1,
    Math.round(
      scraping.pagesChecked || readPagesFromResult(scraping.result) || 25,
    ),
  );
}

export function listPlans(): ListPlansResponse {
  return { plans: planSummaries() };
}

export async function getOrderById(
  orderId: string,
  userId: string,
): Promise<OrderSummary | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      status: true,
      tier: true,
      amountCents: true,
      currency: true,
      website: true,
      projectId: true,
      repoFullName: true,
      checkoutUrl: true,
      fixAttemptsUsed: true,
      chatMessagesUsed: true,
    },
  });

  return order ? orderSummary(order) : null;
}

export async function getPublicOrderById(
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
      projectId: true,
      repoFullName: true,
      checkoutUrl: true,
      fixAttemptsUsed: true,
      chatMessagesUsed: true,
    },
  });

  return order ? publicOrderSummary(order) : null;
}

export async function listBillingHistoryForUser(
  userId: string,
): Promise<BillingHistoryResponse> {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      tier: true,
      amountCents: true,
      currency: true,
      website: true,
      projectId: true,
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
      fixAttemptsUsed: true,
      chatMessagesUsed: true,
    },
  });

  return {
    orders: orders.map(toBillingOrder),
    invoices: [],
  };
}

export async function createFixCheckoutForOrder(input: {
  orderId: string;
  userId: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { user: true },
  });

  if (!order) throw new BillingError(404, "Order not found.");
  if (!order.userId || order.userId !== input.userId) {
    throw new BillingError(403, "You do not have access to this order.");
  }

  return createCheckoutForOrder(order);
}

export async function createFixCheckoutForProject(input: {
  userId: string;
  projectId: string;
  selectedTier?: FixTier;
}) {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, userId: input.userId },
    include: { user: true },
  });
  if (!project) throw new BillingError(404, "Project not found.");

  const scraping = await latestCompletedScraping(project.id, input.userId);
  if (!scraping || !scraping.result) {
    throw new BillingError(400, "Run a completed scan before checkout.");
  }

  const sitemapPageCount = pageCountForScraping(scraping);
  const tier = getFixTierForSelection(sitemapPageCount, input.selectedTier);
  const productId = requireProductId(tier);
  const plan = await ensurePlan(tier);

  const existing = await prisma.order.findFirst({
    where: {
      userId: input.userId,
      projectId: project.id,
      scrapingId: scraping.id,
      tier: tier.tier,
      status: { in: ["PENDING", "CHECKOUT_CREATED", "PROCESSING", "PAID"] },
    },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  if (existing) return createCheckoutForOrder(existing);

  const order = await prisma.order.create({
    data: {
      userId: input.userId,
      projectId: project.id,
      scrapingId: scraping.id,
      planId: plan.id,
      tier: tier.tier,
      amountCents: tier.amountCents,
      currency: tier.currency,
      sitemapPageCount,
      website: project.websiteUrl,
      repoFullName: project.fullName,
      repoConfirmed: true,
      feasibilityPassed: true,
      providerProductId: productId,
    },
    include: { user: true },
  });

  return createCheckoutForOrder(order);
}

export async function getPaidOrderForAgentPlan(input: {
  orderId: string;
  userId: string;
  projectId: string;
}) {
  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      userId: input.userId,
      projectId: input.projectId,
      status: "PAID",
    },
  });

  if (!order) {
    throw new BillingError(402, "A paid AI Search Fix order is required.");
  }
  if (order.fixAttemptsUsed >= FIX_ATTEMPT_LIMIT) {
    throw new BillingError(409, "This order has used all fix attempts.");
  }

  return order;
}

export async function markFixAttemptStarted(orderId: string) {
  await prisma.order.update({
    where: { id: orderId },
    data: { fixAttemptsUsed: { increment: 1 } },
  });
}

async function createCheckoutForOrder(order: OrderForCheckout) {
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

function assertDodoPaymentMatchesOrder(
  payment: DodoPayment,
  order: OrderForCheckout,
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

  const metadata = payment.metadata ?? {};
  if (metadata.order_id && metadata.order_id !== order.id) {
    throw new BillingError(409, "Dodo payment metadata order mismatch.");
  }
  if (
    metadata.provider_product_id &&
    metadata.provider_product_id !== order.providerProductId
  ) {
    throw new BillingError(409, "Dodo payment product metadata mismatch.");
  }
  if (
    metadata.amount_cents &&
    metadata.amount_cents !== String(order.amountCents)
  ) {
    throw new BillingError(409, "Dodo payment amount metadata mismatch.");
  }
  if (
    metadata.currency &&
    metadata.currency.toUpperCase() !== order.currency.toUpperCase()
  ) {
    throw new BillingError(409, "Dodo payment currency metadata mismatch.");
  }
  if (
    payment.currency?.toUpperCase() === order.currency.toUpperCase() &&
    typeof payment.total_amount === "number" &&
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
  userId?: string;
}) {
  if (input.status && input.status !== "succeeded") {
    throw new BillingError(409, "Checkout return is not a succeeded payment.");
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { user: true },
  });
  if (!order) throw new BillingError(404, "Order not found.");
  if (input.userId && order.userId !== input.userId) {
    throw new BillingError(403, "You do not have access to this order.");
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

  const payment = (await retrieveDodoPayment(input.paymentId)) as DodoPayment;
  assertDodoPaymentMatchesOrder(payment, order);

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      providerPaymentId: payment.payment_id,
      providerSessionId: payment.checkout_session_id ?? order.providerSessionId,
      providerCustomerId:
        payment.customer?.customer_id ?? order.providerCustomerId,
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

export async function reconcilePublicFixCheckoutReturn(input: {
  orderId: string;
  paymentId: string;
  status?: string;
}) {
  const result = await reconcileFixCheckoutReturn(input);
  return { order: publicOrderSummary(result.order) };
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
  if (!website) throw new BillingError(400, "A valid website URL is required.");

  const sitemapPageCount = input.sitemapPageCount ?? 25;
  const tier = getFixTierForPageCount(sitemapPageCount);
  const productId = requireProductId(tier);
  const plan = await ensurePlan(tier);
  const email = input.email ?? "dev-billing@geo.repair";

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: input.name ?? "Local Billing Tester" },
    create: {
      email,
      name: input.name ?? "Local Billing Tester",
      username: "local-billing-tester",
    },
  });

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      planId: plan.id,
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

  return createCheckoutForOrder(order);
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

async function cancelActiveRunsForOrder(orderId: string): Promise<void> {
  const active = await prisma.agentRun.findMany({
    where: {
      orderId,
      status: {
        notIn: ["PR_OPENED", "COMPLETED", "FAILED", "CANCELED"],
      },
    },
    select: { id: true, temporalWorkflowId: true },
  });
  if (!active.length) return;

  const client = await getTemporalClient().catch(() => null);
  for (const run of active) {
    if (client && run.temporalWorkflowId) {
      try {
        await client.workflow.getHandle(run.temporalWorkflowId).cancel();
      } catch {
        // Already finished or not cancellable.
      }
    }
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "CANCELED", finishedAt: new Date() },
    });
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
  if (existing) return { duplicate: true, eventType: existing.eventType };

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

      if (
        payload.type.startsWith("refund.") ||
        payload.type.startsWith("dispute.")
      ) {
        await cancelActiveRunsForOrder(order.id);
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
