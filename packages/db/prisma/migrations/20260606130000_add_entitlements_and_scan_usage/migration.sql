-- Per-order entitlement counters: bounded fix-run attempts and post-PR chat messages.
ALTER TABLE "orders" ADD COLUMN "fixAttemptsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "chatMessagesUsed" INTEGER NOT NULL DEFAULT 0;

-- Link a fix run to the paid order it was started against; record the PR push target.
ALTER TABLE "fix_runs" ADD COLUMN "orderId" TEXT;
ALTER TABLE "fix_runs" ADD COLUMN "prViaFork" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "fix_runs_orderId_idx" ON "fix_runs"("orderId");

ALTER TABLE "fix_runs" ADD CONSTRAINT "fix_runs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Free-scan usage counters (per IP for anonymous, per user when signed in).
CREATE TYPE "ScanUsageScope" AS ENUM ('IP', 'USER');

CREATE TABLE "scan_usage" (
    "id" TEXT NOT NULL,
    "scope" "ScanUsageScope" NOT NULL,
    "key" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scan_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scan_usage_scope_key_day_key" ON "scan_usage"("scope", "key", "day");

CREATE INDEX "scan_usage_day_idx" ON "scan_usage"("day");
