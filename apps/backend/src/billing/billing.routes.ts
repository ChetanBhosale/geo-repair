import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware";
import {
  createDevFixtureCheckout,
  createFixCheckout,
  downloadInvoice,
  getBillingHistory,
  getInvoice,
  getOrderStatus,
  handleDodoWebhook,
  listPlans,
  reconcileCheckoutReturn,
} from "./billing.controller";

export const billingRoutes = Router();
billingRoutes.get("/billing/plans", listPlans);
billingRoutes.post("/billing/fix-checkout", requireAuth, createFixCheckout);
billingRoutes.get("/billing/history", requireAuth, getBillingHistory);
billingRoutes.get(
  "/billing/invoices/:orderId/download",
  requireAuth,
  downloadInvoice,
);
billingRoutes.get("/billing/invoices/:orderId", requireAuth, getInvoice);
billingRoutes.get("/billing/orders/:id", getOrderStatus);
billingRoutes.post("/billing/orders/:id/reconcile", reconcileCheckoutReturn);

export const devBillingRoutes = Router();
devBillingRoutes.post("/dev/billing/fixture-order", createDevFixtureCheckout);

export const dodoWebhookRoutes = Router();
dodoWebhookRoutes.post("/", handleDodoWebhook);
