import { describe, expect, test } from "bun:test";

import {
  CreateFixCheckoutRequestSchema,
  OrderSummarySchema,
  ReconcileFixCheckoutRequestSchema,
} from "./billing";

describe("billing schemas", () => {
  test("accepts project-scoped checkout requests", () => {
    expect(
      CreateFixCheckoutRequestSchema.safeParse({
        projectId: "project_123",
      }).success,
    ).toBe(true);
  });

  test("accepts order-scoped checkout retries", () => {
    expect(
      CreateFixCheckoutRequestSchema.safeParse({
        orderId: "order_123",
      }).success,
    ).toBe(true);
  });

  test("rejects unknown selected tiers", () => {
    expect(
      CreateFixCheckoutRequestSchema.safeParse({
        projectId: "project_123",
        selectedTier: "PRO",
      }).success,
    ).toBe(false);
  });

  test("requires the Dodo payment id for return reconciliation", () => {
    expect(
      ReconcileFixCheckoutRequestSchema.safeParse({
        orderId: "order_123",
        paymentId: "pay_123",
        status: "succeeded",
      }).success,
    ).toBe(true);

    expect(
      ReconcileFixCheckoutRequestSchema.safeParse({
        orderId: "order_123",
      }).success,
    ).toBe(false);
  });

  test("allows public checkout-return order summaries without repo details", () => {
    expect(
      OrderSummarySchema.safeParse({
        id: "order_123",
        status: "PAID",
        tier: "GROWTH",
        amountCents: 14900,
        currency: "USD",
        website: "",
        projectId: null,
        repoFullName: null,
        checkoutUrl: null,
        startFixUnlocked: true,
        fixAttemptsUsed: 0,
        fixAttemptLimit: 3,
        chatMessagesUsed: 0,
        chatMessageLimit: 20,
      }).success,
    ).toBe(true);
  });
});
