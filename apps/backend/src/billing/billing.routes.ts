import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware";
import {
  createDevFixtureCheckout,
  createFixCheckout,
  getOrderStatus,
  handleDodoWebhook,
} from "./billing.controller";

export const billingRoutes = Router();
billingRoutes.post("/billing/fix-checkout", requireAuth, createFixCheckout);
billingRoutes.get("/billing/orders/:id", getOrderStatus);

export const devBillingRoutes = Router();
devBillingRoutes.post("/dev/billing/fixture-order", createDevFixtureCheckout);

export const dodoWebhookRoutes = Router();
dodoWebhookRoutes.post("/", handleDodoWebhook);
