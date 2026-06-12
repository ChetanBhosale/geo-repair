import { Router } from "express";

import { requireAuth } from "../middlewares/auth.middleware";
import {
  createDevFixtureCheckout,
  createFixCheckout,
  getBillingHistory,
  getOrderStatus,
  getPlans,
  getPublicOrderStatus,
  handleDodoWebhook,
  reconcileCheckoutReturn,
  reconcilePublicCheckoutReturn,
} from "../controllers/billing.controller";

export const billingRoutes = Router();
billingRoutes.get("/billing/plans", getPlans);
billingRoutes.post("/billing/fix-checkout", requireAuth, createFixCheckout);
billingRoutes.get("/billing/history", requireAuth, getBillingHistory);
billingRoutes.get("/billing/orders/:id", requireAuth, getOrderStatus);
billingRoutes.post(
  "/billing/orders/:id/reconcile",
  requireAuth,
  reconcileCheckoutReturn,
);
billingRoutes.get("/billing/public/orders/:id", getPublicOrderStatus);
billingRoutes.post(
  "/billing/public/orders/:id/reconcile",
  reconcilePublicCheckoutReturn,
);

export const devBillingRoutes = Router();
devBillingRoutes.post("/dev/billing/fixture-order", createDevFixtureCheckout);

export const dodoWebhookRoutes = Router();
dodoWebhookRoutes.post("/", handleDodoWebhook);
