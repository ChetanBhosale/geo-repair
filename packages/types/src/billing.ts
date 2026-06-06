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

export const CreateFixCheckoutRequestSchema = z.object({
  orderId: z.string().optional(),
  repositoryId: z.string().optional(),
  checkupReportKey: z.string().optional(),
  selectedTier: FixTierSchema.optional(),
});
export type CreateFixCheckoutRequest = z.infer<
  typeof CreateFixCheckoutRequestSchema
>;

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

export interface CreateFixCheckoutResponse {
  order: OrderSummary;
  checkoutUrl: string | null;
}

export const ReconcileFixCheckoutRequestSchema = z.object({
  orderId: z.string(),
  paymentId: z.string(),
  status: z.string().optional(),
});
export type ReconcileFixCheckoutRequest = z.infer<
  typeof ReconcileFixCheckoutRequestSchema
>;

export interface ReconcileFixCheckoutResponse {
  order: OrderSummary;
}

export interface BillingOrder {
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
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  refundedAt: string | null;
  disputedAt: string | null;
}

export interface BillingInvoiceLineItem {
  label: string;
  quantity: number;
  amountCents: number;
}

export interface BillingInvoice {
  id: string;
  orderId: string;
  status: OrderStatus;
  amountCents: number;
  currency: string;
  description: string;
  website: string;
  repoFullName: string | null;
  issuedAt: string;
  paidAt: string | null;
  providerPaymentId: string | null;
  downloadUrl: string;
}

export interface BillingInvoiceDetail extends BillingInvoice {
  lineItems: BillingInvoiceLineItem[];
  customerEmail: string | null;
}

export interface BillingHistoryResponse {
  orders: BillingOrder[];
  invoices: BillingInvoice[];
}
