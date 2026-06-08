/*
  Warnings:

  - Made the column `websiteUrl` on table `projects` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "ScrapingStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "LogSource" AS ENUM ('SCRAPING', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "websiteError" TEXT,
ALTER COLUMN "websiteUrl" SET NOT NULL;

-- CreateTable
CREATE TABLE "scrapings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ScrapingStatus" NOT NULL DEFAULT 'QUEUED',
    "websiteUrl" TEXT NOT NULL,
    "result" JSONB,
    "score" INTEGER,
    "scoreStatus" TEXT,
    "pagesChecked" INTEGER NOT NULL DEFAULT 0,
    "pagesFailed" INTEGER NOT NULL DEFAULT 0,
    "repoVerified" BOOLEAN,
    "repoConfidence" DOUBLE PRECISION,
    "error" TEXT,
    "temporalWorkflowId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrapings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" TEXT NOT NULL,
    "source" "LogSource" NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "event" TEXT NOT NULL,
    "message" TEXT,
    "data" JSONB,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "projectId" TEXT,
    "scrapingId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scrapings_temporalWorkflowId_key" ON "scrapings"("temporalWorkflowId");

-- CreateIndex
CREATE INDEX "scrapings_projectId_idx" ON "scrapings"("projectId");

-- CreateIndex
CREATE INDEX "scrapings_userId_idx" ON "scrapings"("userId");

-- CreateIndex
CREATE INDEX "scrapings_status_idx" ON "scrapings"("status");

-- CreateIndex
CREATE INDEX "logs_scrapingId_seq_idx" ON "logs"("scrapingId", "seq");

-- CreateIndex
CREATE INDEX "logs_projectId_idx" ON "logs"("projectId");

-- CreateIndex
CREATE INDEX "logs_source_event_idx" ON "logs"("source", "event");

-- AddForeignKey
ALTER TABLE "scrapings" ADD CONSTRAINT "scrapings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrapings" ADD CONSTRAINT "scrapings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_scrapingId_fkey" FOREIGN KEY ("scrapingId") REFERENCES "scrapings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
