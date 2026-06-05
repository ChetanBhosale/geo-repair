import DodoPayments from "dodopayments";

import Secrets from "@repo/secrets/backend";

type DodoEnvironment = "test_mode" | "live_mode";

type DodoCheckoutInput = {
  orderId: string;
  productId: string;
  customer?: {
    email?: string | null;
    name?: string | null;
  };
  returnUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
};

export type DodoWebhookHeaders = {
  "webhook-id": string;
  "webhook-signature": string;
  "webhook-timestamp": string;
};

export type DodoWebhookPayload = {
  business_id?: string;
  type: string;
  timestamp?: string;
  data?: {
    payment_id?: string | null;
    checkout_session_id?: string | null;
    total_amount?: number | null;
    currency?: string | null;
    metadata?: Record<string, string> | null;
    customer?: {
      customer_id?: string | null;
      email?: string | null;
      name?: string | null;
    } | null;
    payment?: {
      payment_id?: string | null;
    } | null;
  };
};

function dodoClient(): DodoPayments {
  if (!Secrets.DODO_PAYMENTS_API_KEY) {
    throw new Error("DODO_PAYMENTS_API_KEY is required for Dodo checkout.");
  }

  return new DodoPayments({
    bearerToken: Secrets.DODO_PAYMENTS_API_KEY,
    webhookKey: Secrets.DODO_PAYMENTS_WEBHOOK_KEY,
    environment: Secrets.DODO_PAYMENTS_ENVIRONMENT as DodoEnvironment,
  });
}

export async function createDodoCheckoutSession(input: DodoCheckoutInput) {
  const customer =
    input.customer?.email && input.customer.email.includes("@")
      ? {
          email: input.customer.email,
          name: input.customer.name ?? undefined,
        }
      : undefined;

  const session = await dodoClient().checkoutSessions.create({
    product_cart: [{ product_id: input.productId, quantity: 1 }],
    customer,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    metadata: input.metadata,
  });

  if (!session.checkout_url) {
    throw new Error("Dodo did not return a checkout URL.");
  }

  return {
    sessionId: session.session_id,
    checkoutUrl: session.checkout_url,
    paymentId: session.payment_id ?? null,
  };
}

export async function retrieveDodoPayment(paymentId: string) {
  return dodoClient().payments.retrieve(paymentId);
}

export function unwrapDodoWebhook(
  rawBody: string,
  headers: DodoWebhookHeaders,
): DodoWebhookPayload {
  if (!Secrets.DODO_PAYMENTS_WEBHOOK_KEY) {
    throw new Error("DODO_PAYMENTS_WEBHOOK_KEY is required for Dodo webhooks.");
  }

  return dodoClient().webhooks.unwrap(rawBody, {
    headers,
  }) as DodoWebhookPayload;
}
