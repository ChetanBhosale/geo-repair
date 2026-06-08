/*
  Warnings:

  - A unique constraint covering the columns `[agentRunId]` on the table `worker_status` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "worker_status" ADD COLUMN     "agentRunId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "worker_status_agentRunId_key" ON "worker_status"("agentRunId");

-- AddForeignKey
ALTER TABLE "worker_status" ADD CONSTRAINT "worker_status_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
