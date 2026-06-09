-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'PLANNING', 'AWAITING_INPUT', 'FIXING', 'VERIFYING', 'OPENING_PR', 'PR_OPENED', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SandboxStatus" AS ENUM ('NONE', 'CREATING', 'RUNNING', 'STOPPED', 'KILLED');

-- CreateEnum
CREATE TYPE "PrState" AS ENUM ('NONE', 'OPEN', 'MERGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AgentPlanMode" AS ENUM ('AUTO', 'NEEDS_INPUT');

-- CreateEnum
CREATE TYPE "AgentPlanChoice" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "AgentPlanOutcome" AS ENUM ('PENDING', 'FIXED', 'SKIPPED_BY_USER', 'FLAGGED_MANUAL', 'ALREADY_OK', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentPlanStatus" AS ENUM ('DRAFTING', 'AWAITING_USER', 'SUBMITTED', 'FAILED');

-- AlterTable
ALTER TABLE "logs" ADD COLUMN     "agentPlanId" TEXT,
ADD COLUMN     "agentRunId" TEXT;

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scrapingId" TEXT,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "sandboxId" TEXT,
    "sandboxStatus" "SandboxStatus" NOT NULL DEFAULT 'NONE',
    "branch" TEXT,
    "prUrl" TEXT,
    "prNumber" INTEGER,
    "prState" "PrState" NOT NULL DEFAULT 'NONE',
    "prOpenedAt" TIMESTAMP(3),
    "prMergedAt" TIMESTAMP(3),
    "prClosedAt" TIMESTAMP(3),
    "temporalWorkflowId" TEXT,
    "scoreBefore" INTEGER,
    "scoreAfter" INTEGER,
    "rubricVersion" TEXT,
    "totalChecks" INTEGER NOT NULL DEFAULT 0,
    "fixedChecks" INTEGER NOT NULL DEFAULT 0,
    "skippedChecks" INTEGER NOT NULL DEFAULT 0,
    "pendingChecks" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "tokenCostCents" INTEGER NOT NULL DEFAULT 0,
    "sandboxSeconds" INTEGER NOT NULL DEFAULT 0,
    "sandboxCostCents" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_plans" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "status" "AgentPlanStatus" NOT NULL DEFAULT 'DRAFTING',
    "summary" TEXT,
    "manual" JSONB,
    "scoreBefore" INTEGER,
    "rubricVersion" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_plan_checks" (
    "id" TEXT NOT NULL,
    "agentPlanId" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "scanStatus" TEXT,
    "fixableByAgent" TEXT,
    "evidence" TEXT,
    "recommendation" TEXT,
    "mode" "AgentPlanMode" NOT NULL DEFAULT 'AUTO',
    "approach" TEXT,
    "targetPages" JSONB,
    "question" TEXT,
    "options" JSONB,
    "choice" "AgentPlanChoice" NOT NULL DEFAULT 'PENDING',
    "selectedOption" TEXT,
    "userSuggestion" TEXT,
    "outcome" "AgentPlanOutcome" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_plan_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_runs_temporalWorkflowId_key" ON "agent_runs"("temporalWorkflowId");

-- CreateIndex
CREATE INDEX "agent_runs_projectId_idx" ON "agent_runs"("projectId");

-- CreateIndex
CREATE INDEX "agent_runs_userId_status_idx" ON "agent_runs"("userId", "status");

-- CreateIndex
CREATE INDEX "agent_runs_scrapingId_idx" ON "agent_runs"("scrapingId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_plans_agentRunId_key" ON "agent_plans"("agentRunId");

-- CreateIndex
CREATE INDEX "agent_plan_checks_agentPlanId_seq_idx" ON "agent_plan_checks"("agentPlanId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "agent_plan_checks_agentPlanId_rubricId_key" ON "agent_plan_checks"("agentPlanId", "rubricId");

-- CreateIndex
CREATE INDEX "logs_agentRunId_seq_idx" ON "logs"("agentRunId", "seq");

-- CreateIndex
CREATE INDEX "logs_agentPlanId_idx" ON "logs"("agentPlanId");

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_agentPlanId_fkey" FOREIGN KEY ("agentPlanId") REFERENCES "agent_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_scrapingId_fkey" FOREIGN KEY ("scrapingId") REFERENCES "scrapings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_plans" ADD CONSTRAINT "agent_plans_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_plan_checks" ADD CONSTRAINT "agent_plan_checks_agentPlanId_fkey" FOREIGN KEY ("agentPlanId") REFERENCES "agent_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
