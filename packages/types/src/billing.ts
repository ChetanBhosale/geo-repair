import { z } from "zod";

export const FixTierSchema = z.enum([
  "STARTER",
  "GROWTH",
  "SCALE",
  "ENTERPRISE_CUSTOM",
]);
export type FixTier = z.infer<typeof FixTierSchema>;

export const OrderStatusSchema = z.enum([
  "PENDING",
  "CHECKOUT_CREATED",
  "PROCESSING",
  "PAID",
  "FAILED",
  "CANCELED",
  "REFUNDED",
  "DISPUTED",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderSummarySchema = z.object({
  id: z.string(),
  status: OrderStatusSchema,
  tier: FixTierSchema,
  amountCents: z.number().int().nonnegative(),
  currency: z.string(),
  website: z.string(),
  repoFullName: z.string().nullable(),
  checkoutUrl: z.string().url().nullable(),
  startFixUnlocked: z.boolean(),
});
export type OrderSummary = z.infer<typeof OrderSummarySchema>;
