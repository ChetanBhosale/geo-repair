-- AlterEnum
ALTER TYPE "AgentRunStatus" ADD VALUE 'CHATTING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LogSource" ADD VALUE 'AGENT_FILE';
ALTER TYPE "LogSource" ADD VALUE 'USER';

-- AlterTable
ALTER TABLE "agent_runs" ADD COLUMN     "chatMessagesLeft" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "prMerged" BOOLEAN NOT NULL DEFAULT false;
