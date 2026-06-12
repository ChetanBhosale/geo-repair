CREATE TYPE "OrderKind" AS ENUM ('FIX');
CREATE TYPE "OrderTier" AS ENUM ('STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE_CUSTOM');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CHECKOUT_CREATED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED', 'DISPUTED');
CREATE TYPE "OrderResolutionState" AS ENUM ('OPEN', 'SUPPORT_REQUIRED', 'REFUND_PENDING', 'REFUNDED', 'CLOSED');
CREATE TYPE "PaymentProvider" AS ENUM ('DODO');
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED', 'DUPLICATE');

CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "tier" "OrderTier" NOT NULL,
    "name" TEXT NOT NULL,
    "maxPages" INTEGER,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "providerProductId" TEXT,
    "details" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "kind" "OrderKind" NOT NULL DEFAULT 'FIX',
    "tier" "OrderTier" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionState" "OrderResolutionState" NOT NULL DEFAULT 'OPEN',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'DODO',
    "planId" TEXT,
    "userId" TEXT,
    "projectId" TEXT,
    "scrapingId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sitemapPageCount" INTEGER NOT NULL,
    "website" TEXT NOT NULL,
    "repoFullName" TEXT,
    "repoConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "feasibilityPassed" BOOLEAN NOT NULL DEFAULT false,
    "checkoutUrl" TEXT,
    "providerProductId" TEXT NOT NULL,
    "providerSessionId" TEXT,
    "providerPaymentId" TEXT,
    "providerCustomerId" TEXT,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "fixAttemptsUsed" INTEGER NOT NULL DEFAULT 0,
    "chatMessagesUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "paymentWebhookEvents" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'DODO',
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processingStatus" "WebhookProcessingStatus" NOT NULL DEFAULT 'PROCESSING',
    "providerPaymentId" TEXT,
    "orderId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paymentWebhookEvents_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "agent_runs" ADD COLUMN "orderId" TEXT;
ALTER TABLE "agent_runs" ALTER COLUMN "chatMessagesLeft" SET DEFAULT 20;

CREATE UNIQUE INDEX "plans_tier_key" ON "plans"("tier");
CREATE INDEX "plans_active_idx" ON "plans"("active");

CREATE UNIQUE INDEX "orders_providerSessionId_key" ON "orders"("providerSessionId");
CREATE UNIQUE INDEX "orders_providerPaymentId_key" ON "orders"("providerPaymentId");
CREATE INDEX "orders_userId_status_idx" ON "orders"("userId", "status");
CREATE INDEX "orders_projectId_idx" ON "orders"("projectId");
CREATE INDEX "orders_scrapingId_idx" ON "orders"("scrapingId");
CREATE INDEX "orders_planId_idx" ON "orders"("planId");
CREATE INDEX "orders_provider_providerPaymentId_idx" ON "orders"("provider", "providerPaymentId");
CREATE INDEX "orders_provider_providerSessionId_idx" ON "orders"("provider", "providerSessionId");

CREATE UNIQUE INDEX "paymentWebhookEvents_provider_providerEventId_key" ON "paymentWebhookEvents"("provider", "providerEventId");
CREATE INDEX "paymentWebhookEvents_provider_eventType_idx" ON "paymentWebhookEvents"("provider", "eventType");
CREATE INDEX "paymentWebhookEvents_providerPaymentId_idx" ON "paymentWebhookEvents"("providerPaymentId");
CREATE INDEX "paymentWebhookEvents_orderId_idx" ON "paymentWebhookEvents"("orderId");

CREATE INDEX "agent_runs_orderId_idx" ON "agent_runs"("orderId");

ALTER TABLE "orders" ADD CONSTRAINT "orders_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_scrapingId_fkey" FOREIGN KEY ("scrapingId") REFERENCES "scrapings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "paymentWebhookEvents" ADD CONSTRAINT "paymentWebhookEvents_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
