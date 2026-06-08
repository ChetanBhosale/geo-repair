/*
  Warnings:

  - You are about to drop the column `agentRunId` on the `logs` table. All the data in the column will be lost.
  - You are about to drop the column `agentRunId` on the `worker_status` table. All the data in the column will be lost.
  - You are about to drop the `agent_checks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `agent_file_changes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `agent_messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `agent_runs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "agent_checks" DROP CONSTRAINT "agent_checks_agentRunId_fkey";

-- DropForeignKey
ALTER TABLE "agent_file_changes" DROP CONSTRAINT "agent_file_changes_agentRunId_fkey";

-- DropForeignKey
ALTER TABLE "agent_messages" DROP CONSTRAINT "agent_messages_agentRunId_fkey";

-- DropForeignKey
ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_projectId_fkey";

-- DropForeignKey
ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_scrapingId_fkey";

-- DropForeignKey
ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_userId_fkey";

-- DropForeignKey
ALTER TABLE "logs" DROP CONSTRAINT "logs_agentRunId_fkey";

-- DropForeignKey
ALTER TABLE "worker_status" DROP CONSTRAINT "worker_status_agentRunId_fkey";

-- DropIndex
DROP INDEX "logs_agentRunId_seq_idx";

-- DropIndex
DROP INDEX "worker_status_agentRunId_key";

-- AlterTable
ALTER TABLE "logs" DROP COLUMN "agentRunId";

-- AlterTable
ALTER TABLE "worker_status" DROP COLUMN "agentRunId";

-- DropTable
DROP TABLE "agent_checks";

-- DropTable
DROP TABLE "agent_file_changes";

-- DropTable
DROP TABLE "agent_messages";

-- DropTable
DROP TABLE "agent_runs";

-- DropEnum
DROP TYPE "AgentCheckStatus";

-- DropEnum
DROP TYPE "AgentFileAction";

-- DropEnum
DROP TYPE "AgentMessageKind";

-- DropEnum
DROP TYPE "AgentMessageRole";

-- DropEnum
DROP TYPE "AgentRunStatus";

-- DropEnum
DROP TYPE "PrState";

-- DropEnum
DROP TYPE "SandboxStatus";
