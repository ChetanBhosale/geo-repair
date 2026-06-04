import type { Request, Response } from "express";

import {
  BillingError,
  createDevFixtureOrder,
  createFixCheckoutForOrder,
  getOrderById,
  processDodoWebhook,
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
    const orderId = stringBodyValue((req.body as { orderId?: unknown }).orderId);
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required." });
    }

    const result = await createFixCheckoutForOrder({
      orderId,
      userId: req.userId!,
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

function webhookHeader(req: Request, name: keyof DodoWebhookHeaders): string | null {
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
