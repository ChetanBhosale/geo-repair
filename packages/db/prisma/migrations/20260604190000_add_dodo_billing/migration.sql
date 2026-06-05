-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('FIX');

-- CreateEnum
CREATE TYPE "OrderTier" AS ENUM ('STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE_CUSTOM');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CHECKOUT_CREATED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "OrderResolutionState" AS ENUM ('OPEN', 'SUPPORT_REQUIRED', 'REFUND_PENDING', 'REFUNDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('DODO');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "kind" "OrderKind" NOT NULL DEFAULT 'FIX',
    "tier" "OrderTier" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionState" "OrderResolutionState" NOT NULL DEFAULT 'OPEN',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'DODO',
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
    "checkupReportId" TEXT,
    "userId" TEXT,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "orders_providerSessionId_key" ON "orders"("providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_providerPaymentId_key" ON "orders"("providerPaymentId");

-- CreateIndex
CREATE INDEX "orders_userId_status_idx" ON "orders"("userId", "status");

-- CreateIndex
CREATE INDEX "orders_checkupReportId_idx" ON "orders"("checkupReportId");

-- CreateIndex
CREATE INDEX "orders_provider_providerPaymentId_idx" ON "orders"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "orders_provider_providerSessionId_idx" ON "orders"("provider", "providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "paymentWebhookEvents_provider_providerEventId_key" ON "paymentWebhookEvents"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "paymentWebhookEvents_provider_eventType_idx" ON "paymentWebhookEvents"("provider", "eventType");

-- CreateIndex
CREATE INDEX "paymentWebhookEvents_providerPaymentId_idx" ON "paymentWebhookEvents"("providerPaymentId");

-- CreateIndex
CREATE INDEX "paymentWebhookEvents_orderId_idx" ON "paymentWebhookEvents"("orderId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkupReportId_fkey" FOREIGN KEY ("checkupReportId") REFERENCES "checkupReports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paymentWebhookEvents" ADD CONSTRAINT "paymentWebhookEvents_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
