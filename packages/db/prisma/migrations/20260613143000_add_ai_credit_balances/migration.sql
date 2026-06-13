ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "aiCreditsIncluded" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aiCreditsUsed" INTEGER NOT NULL DEFAULT 0;

UPDATE "orders"
SET "aiCreditsIncluded" = CASE "tier"::text
  WHEN 'STARTER' THEN 3000000
  WHEN 'GROWTH' THEN 10000000
  WHEN 'SCALE' THEN 25000000
  ELSE 0
END
WHERE "aiCreditsIncluded" = 0;

CREATE TABLE IF NOT EXISTS "ai_usage_events" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "agentRunId" TEXT,
  "workflowId" TEXT,
  "model" TEXT,
  "reason" TEXT,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "inputCredits" INTEGER NOT NULL DEFAULT 0,
  "outputCredits" INTEGER NOT NULL DEFAULT 0,
  "totalCredits" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ai_usage_events"
  ADD CONSTRAINT "ai_usage_events_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_usage_events"
  ADD CONSTRAINT "ai_usage_events_agentRunId_fkey"
  FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ai_usage_events_orderId_createdAt_idx"
  ON "ai_usage_events"("orderId", "createdAt");

CREATE INDEX IF NOT EXISTS "ai_usage_events_agentRunId_idx"
  ON "ai_usage_events"("agentRunId");
