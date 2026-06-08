/*
  Warnings:

  - You are about to drop the column `isDeleted` on the `projects` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'PLANNING', 'AWAITING_INPUT', 'FIXING', 'RECONCILING', 'OPENING_PR', 'PR_OPENED', 'CHATTING', 'COMPLETED', 'MERGED', 'CLOSED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SandboxStatus" AS ENUM ('NONE', 'CREATING', 'RUNNING', 'STOPPED', 'KILLED');

-- CreateEnum
CREATE TYPE "AgentCheckStatus" AS ENUM ('PENDING', 'FIXED', 'SKIPPED_BY_USER', 'FLAGGED_MANUAL', 'NOT_APPLICABLE', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentMessageRole" AS ENUM ('ASSISTANT', 'USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AgentMessageKind" AS ENUM ('PLAN', 'QUESTIONS', 'ANSWERS', 'MESSAGE', 'STATUS');

-- CreateEnum
CREATE TYPE "AgentFileAction" AS ENUM ('CREATE', 'MODIFY', 'DELETE');

-- CreateEnum
CREATE TYPE "PrState" AS ENUM ('NONE', 'OPEN', 'MERGED', 'CLOSED');

-- AlterTable
ALTER TABLE "logs" ADD COLUMN     "agentRunId" TEXT;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "isDeleted";

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
CREATE TABLE "agent_checks" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "status" "AgentCheckStatus" NOT NULL DEFAULT 'PENDING',
    "fixed" BOOLEAN NOT NULL DEFAULT false,
    "questionAsked" TEXT,
    "userDecision" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "role" "AgentMessageRole" NOT NULL,
    "kind" "AgentMessageKind" NOT NULL DEFAULT 'MESSAGE',
    "content" TEXT,
    "payload" JSONB,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_file_changes" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "action" "AgentFileAction" NOT NULL,
    "rubricId" TEXT,
    "summary" TEXT,
    "patch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_file_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_runs_temporalWorkflowId_key" ON "agent_runs"("temporalWorkflowId");

-- CreateIndex
CREATE INDEX "agent_runs_projectId_idx" ON "agent_runs"("projectId");

-- CreateIndex
CREATE INDEX "agent_runs_userId_status_idx" ON "agent_runs"("userId", "status");

-- CreateIndex
CREATE INDEX "agent_checks_agentRunId_idx" ON "agent_checks"("agentRunId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_checks_agentRunId_rubricId_key" ON "agent_checks"("agentRunId", "rubricId");

-- CreateIndex
CREATE INDEX "agent_messages_agentRunId_seq_idx" ON "agent_messages"("agentRunId", "seq");

-- CreateIndex
CREATE INDEX "agent_file_changes_agentRunId_idx" ON "agent_file_changes"("agentRunId");

-- CreateIndex
CREATE INDEX "logs_agentRunId_seq_idx" ON "logs"("agentRunId", "seq");

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_scrapingId_fkey" FOREIGN KEY ("scrapingId") REFERENCES "scrapings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_checks" ADD CONSTRAINT "agent_checks_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_file_changes" ADD CONSTRAINT "agent_file_changes_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
