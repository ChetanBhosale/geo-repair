import type { Request, Response } from "express";

import {
  CreateFixCheckoutRequestSchema,
  ReconcileFixCheckoutRequestSchema,
  type CreateFixCheckoutRequest,
} from "@repo/types/billing";

import {
  BillingError,
  createDevFixtureOrder,
  createFixCheckoutForOrder,
  createFixCheckoutForSelection,
  getInvoiceForUser,
  getOrderById,
  invoiceDownloadFilename,
  listBillingHistoryForUser,
  processDodoWebhook,
  reconcileFixCheckoutReturn,
  renderInvoiceMarkdown,
} from "./billing.service";
import type { DodoWebhookHeaders } from "./providers/dodo";

function sendBillingError(res: Response, err: unknown): Response {
  if (err instanceof BillingError) {
    return res.status(err.status).json({ error: err.message });
  }

  throw err;
}

function stringBodyValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function intBodyValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

export async function createFixCheckout(req: Request, res: Response) {
  try {
    const parsed = CreateFixCheckoutRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid checkout request." });
    }

    const body: CreateFixCheckoutRequest = parsed.data;
    const orderId = stringBodyValue(body.orderId);
    if (orderId) {
      const result = await createFixCheckoutForOrder({
        orderId,
        userId: req.userId!,
      });

      return res.status(201).json(result);
    }

    const repositoryId = stringBodyValue(body.repositoryId);
    const checkupReportKey = stringBodyValue(body.checkupReportKey);
    if (!repositoryId || !checkupReportKey) {
      return res.status(400).json({
        error: "repositoryId and checkupReportKey are required.",
      });
    }

    const result = await createFixCheckoutForSelection({
      userId: req.userId!,
      repositoryId,
      checkupReportKey,
      selectedTier: body.selectedTier,
    });

    return res.status(201).json(result);
  } catch (err) {
    return sendBillingError(res, err);
  }
}

export async function getOrderStatus(req: Request, res: Response) {
  try {
    const orderId = stringBodyValue(req.params.id);
    if (!orderId) {
      return res.status(400).json({ error: "id is required." });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    return res.json({ order });
  } catch (err) {
    return sendBillingError(res, err);
  }
}

export async function reconcileCheckoutReturn(req: Request, res: Response) {
  try {
    const parsed = ReconcileFixCheckoutRequestSchema.safeParse({
      ...req.body,
      orderId: req.params.id,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid reconcile request." });
    }

    const result = await reconcileFixCheckoutReturn(parsed.data);
    return res.json(result);
  } catch (err) {
    return sendBillingError(res, err);
  }
}

export async function getBillingHistory(req: Request, res: Response) {
  try {
    const history = await listBillingHistoryForUser(req.userId!);
    return res.json(history);
  } catch (err) {
    return sendBillingError(res, err);
  }
}

export async function getInvoice(req: Request, res: Response) {
  try {
    const orderId = stringBodyValue(req.params.orderId);
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required." });
    }

    const invoice = await getInvoiceForUser(req.userId!, orderId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    return res.json({ invoice });
  } catch (err) {
    return sendBillingError(res, err);
  }
}

export async function downloadInvoice(req: Request, res: Response) {
  try {
    const orderId = stringBodyValue(req.params.orderId);
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required." });
    }

    const invoice = await getInvoiceForUser(req.userId!, orderId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoiceDownloadFilename(invoice)}"`,
    );
    return res.send(renderInvoiceMarkdown(invoice));
  } catch (err) {
    return sendBillingError(res, err);
  }
}

export async function createDevFixtureCheckout(req: Request, res: Response) {
  try {
    const body = req.body as Record<string, unknown>;
    const result = await createDevFixtureOrder({
      website: stringBodyValue(body.website) ?? undefined,
      email: stringBodyValue(body.email) ?? undefined,
      name: stringBodyValue(body.name) ?? undefined,
      repoFullName: stringBodyValue(body.repoFullName) ?? undefined,
      sitemapPageCount: intBodyValue(body.sitemapPageCount),
    });

    return res.status(201).json(result);
  } catch (err) {
    return sendBillingError(res, err);
  }
}

function webhookHeader(
  req: Request,
  name: keyof DodoWebhookHeaders,
): string | null {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" && value ? value : null;
}

export async function handleDodoWebhook(req: Request, res: Response) {
  try {
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: "Expected raw webhook body." });
    }

    const headers = {
      "webhook-id": webhookHeader(req, "webhook-id"),
      "webhook-signature": webhookHeader(req, "webhook-signature"),
      "webhook-timestamp": webhookHeader(req, "webhook-timestamp"),
    };

    if (
      !headers["webhook-id"] ||
      !headers["webhook-signature"] ||
      !headers["webhook-timestamp"]
    ) {
      return res.status(400).json({ error: "Missing Dodo webhook headers." });
    }

    const result = await processDodoWebhook({
      rawBody: req.body.toString("utf8"),
      headers: headers as DodoWebhookHeaders,
    });

    return res.json({ received: true, ...result });
  } catch (err) {
    if (err instanceof BillingError) {
      return res.status(err.status).json({ error: err.message });
    }

    return res.status(401).json({ error: "Invalid Dodo webhook." });
  }
}
