import { beforeEach, expect, mock, test } from "bun:test";

type OrderRow = {
  id: string;
  status: string;
  tier: string;
  amountCents: number;
  currency: string;
  website: string;
  repoFullName: string | null;
  checkoutUrl: string | null;
  providerProductId: string;
  providerPaymentId: string | null;
  providerSessionId: string | null;
  providerCustomerId: string | null;
  repoConfirmed: boolean;
  feasibilityPassed: boolean;
};

type EventRow = {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  processingStatus: string;
  providerPaymentId: string | null;
  orderId: string | null;
  rawPayload: unknown;
};

const orders = new Map<string, OrderRow>();
const events = new Map<string, EventRow>();
let nextId = 1;

type PlanRow = {
  id: string;
  tier: string;
  name: string;
  maxPages: number | null;
  amountCents: number;
  currency: string;
  providerProductId: string | null;
  details: unknown;
  sortOrder: number;
  active: boolean;
};

const PLANS: PlanRow[] = [
  {
    id: "plan_starter",
    tier: "STARTER",
    name: "Starter",
    maxPages: 25,
    amountCents: 4900,
    currency: "USD",
    providerProductId: "prod_starter",
    details: null,
    sortOrder: 0,
    active: true,
  },
  {
    id: "plan_growth",
    tier: "GROWTH",
    name: "Growth",
    maxPages: 100,
    amountCents: 14900,
    currency: "USD",
    providerProductId: "prod_growth",
    details: null,
    sortOrder: 1,
    active: true,
  },
  {
    id: "plan_scale",
    tier: "SCALE",
    name: "Scale",
    maxPages: 250,
    amountCents: 39900,
    currency: "USD",
    providerProductId: "prod_scale",
    details: null,
    sortOrder: 2,
    active: true,
  },
  {
    id: "plan_enterprise",
    tier: "ENTERPRISE_CUSTOM",
    name: "Enterprise",
    maxPages: null,
    amountCents: 0,
    currency: "USD",
    providerProductId: null,
    details: null,
    sortOrder: 3,
    active: true,
  },
];

function resetStore() {
  orders.clear();
  events.clear();
  nextId = 1;
}

const prisma = {
  plan: {
    async findMany(): Promise<PlanRow[]> {
      return [...PLANS].sort((a, b) => a.sortOrder - b.sortOrder);
    },
  },
  order: {
    async findUnique(args: {
      where: {
        id?: string;
        providerPaymentId?: string;
        providerSessionId?: string;
      };
    }): Promise<OrderRow | null> {
      if (args.where.id) return orders.get(args.where.id) ?? null;
      if (args.where.providerPaymentId) {
        return (
          [...orders.values()].find(
            (order) => order.providerPaymentId === args.where.providerPaymentId,
          ) ?? null
        );
      }
      if (args.where.providerSessionId) {
        return (
          [...orders.values()].find(
            (order) => order.providerSessionId === args.where.providerSessionId,
          ) ?? null
        );
      }
      return null;
    },
    async update(args: {
      where: { id: string };
      data: Partial<OrderRow>;
    }): Promise<OrderRow> {
      const order = orders.get(args.where.id);
      if (!order) throw new Error("order not found");
      Object.assign(order, args.data);
      return order;
    },
  },
  paymentWebhookEvent: {
    async findUnique(args: {
      where: {
        provider_providerEventId: {
          provider: string;
          providerEventId: string;
        };
      };
    }): Promise<EventRow | null> {
      return (
        [...events.values()].find(
          (event) =>
            event.provider === args.where.provider_providerEventId.provider &&
            event.providerEventId ===
              args.where.provider_providerEventId.providerEventId,
        ) ?? null
      );
    },
    async create(args: {
      data: Omit<EventRow, "id" | "processingStatus" | "orderId"> & {
        processingStatus?: string;
        orderId?: string | null;
      };
    }): Promise<EventRow> {
      const event = {
        id: `event-${nextId++}`,
        processingStatus: args.data.processingStatus ?? "PROCESSING",
        orderId: args.data.orderId ?? null,
        ...args.data,
      };
      events.set(event.id, event);
      return event;
    },
    async update(args: {
      where: { id: string };
      data: Partial<EventRow>;
    }): Promise<EventRow> {
      const event = events.get(args.where.id);
      if (!event) throw new Error("event not found");
      Object.assign(event, args.data);
      return event;
    },
  },
};

mock.module("@repo/db", () => ({ prisma }));
mock.module("@repo/secrets/backend", () => ({
  default: {
    NODE_ENV: "test",
    FRONTEND_URL: "http://localhost:3000",
    DODO_PRODUCT_ID_STARTER: "prod_starter",
    DODO_PRODUCT_ID_GROWTH: "prod_growth",
    DODO_PRODUCT_ID_SCALE: "prod_scale",
    ENABLE_DEV_BILLING_FIXTURES: true,
  },
}));
mock.module("./providers/dodo", () => ({
  createDodoCheckoutSession: async () => ({
    sessionId: "cks_test",
    checkoutUrl: "https://test.checkout.dodopayments.com/session/cks_test",
    paymentId: null,
  }),
  retrieveDodoPayment: async () => ({
    payment_id: "pay_1",
    status: "succeeded",
    checkout_session_id: "cks_1",
    metadata: {},
    total_amount: 4900,
    currency: "USD",
    product_cart: [{ product_id: "prod_starter", quantity: 1 }],
    customer: { customer_id: "cus_1" },
  }),
  unwrapDodoWebhook: (rawBody: string) => JSON.parse(rawBody),
}));

const {
  BillingError,
  getPlanForPageCount,
  getPlanForSelection,
  processDodoWebhook,
} = await import("./billing.service.ts");

beforeEach(() => {
  resetStore();
});

test("plan resolution matches the seeded price table", async () => {
  expect(await getPlanForPageCount(25)).toMatchObject({
    tier: "STARTER",
    amountCents: 4900,
    providerProductId: "prod_starter",
  });
  expect(await getPlanForPageCount(100)).toMatchObject({
    tier: "GROWTH",
    amountCents: 14900,
    providerProductId: "prod_growth",
  });
  expect(await getPlanForPageCount(250)).toMatchObject({
    tier: "SCALE",
    amountCents: 39900,
    providerProductId: "prod_scale",
  });
  expect(await getPlanForPageCount(251)).toMatchObject({
    tier: "ENTERPRISE_CUSTOM",
    amountCents: 0,
  });
});

test("selected plan can be higher but not lower than the scan tier", async () => {
  expect(await getPlanForSelection(25, "GROWTH")).toMatchObject({
    tier: "GROWTH",
    amountCents: 14900,
    providerProductId: "prod_growth",
  });

  await expect(getPlanForSelection(100, "STARTER")).rejects.toThrow(
    BillingError,
  );
});

test("payment.succeeded marks the order paid and duplicate webhook ids are ignored", async () => {
  orders.set("order-1", {
    id: "order-1",
    status: "CHECKOUT_CREATED",
    tier: "STARTER",
    amountCents: 4900,
    currency: "USD",
    website: "https://example.com",
    repoFullName: "local/example",
    checkoutUrl: "https://test.checkout.dodopayments.com/session/abc",
    providerProductId: "prod_starter",
    providerPaymentId: null,
    providerSessionId: "cks_1",
    providerCustomerId: null,
    repoConfirmed: true,
    feasibilityPassed: true,
  });

  const payload = {
    type: "payment.succeeded",
    data: {
      payment_id: "pay_1",
      checkout_session_id: "cks_1",
      customer: { customer_id: "cus_1" },
      metadata: {
        order_id: "order-1",
        tier: "STARTER",
        amount_cents: "4900",
        currency: "USD",
        provider_product_id: "prod_starter",
      },
    },
  };

  const first = await processDodoWebhook({
    rawBody: JSON.stringify(payload),
    headers: {
      "webhook-id": "wh_1",
      "webhook-signature": "sig",
      "webhook-timestamp": "123",
    },
  });
  const second = await processDodoWebhook({
    rawBody: JSON.stringify(payload),
    headers: {
      "webhook-id": "wh_1",
      "webhook-signature": "sig",
      "webhook-timestamp": "123",
    },
  });

  expect(first).toEqual({ duplicate: false, eventType: "payment.succeeded" });
  expect(second).toEqual({ duplicate: true, eventType: "payment.succeeded" });
  expect(orders.get("order-1")?.status).toBe("PAID");
  expect(orders.get("order-1")?.providerPaymentId).toBe("pay_1");
  expect([...events.values()]).toHaveLength(1);
});
