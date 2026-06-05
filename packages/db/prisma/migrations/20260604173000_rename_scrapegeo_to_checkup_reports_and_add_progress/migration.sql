-- RenameTable
ALTER TABLE "scrapeGeo" RENAME TO "checkupReports";

-- RenameColumn
ALTER TABLE "checkupReports" RENAME COLUMN "websiteScrapeData" TO "reportData";

-- RenameColumn
ALTER TABLE "checkupReports" RENAME COLUMN "totalScrapeCount" TO "totalCheckupCount";

-- RenameIndex
ALTER INDEX "scrapeGeo_website_key" RENAME TO "checkupReports_website_key";

-- RenameIndex
ALTER INDEX "scrapeGeo_website_idx" RENAME TO "checkupReports_website_idx";

-- RenameIndex
ALTER INDEX "scrapeGeo_websiteType_idx" RENAME TO "checkupReports_websiteType_idx";

-- CreateTable
CREATE TABLE "checkupRuns" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "phase" TEXT NOT NULL DEFAULT 'queued',
    "pagesTotal" INTEGER NOT NULL DEFAULT 0,
    "pagesCompleted" INTEGER NOT NULL DEFAULT 0,
    "pagesFailed" INTEGER NOT NULL DEFAULT 0,
    "checksEvaluated" INTEGER NOT NULL DEFAULT 0,
    "issuesFound" INTEGER NOT NULL DEFAULT 0,
    "currentPageUrl" TEXT,
    "resultKey" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkupRuns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkupRunEvents" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "pageUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkupRunEvents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checkupRuns_workflowId_key" ON "checkupRuns"("workflowId");

-- CreateIndex
CREATE INDEX "checkupRuns_website_idx" ON "checkupRuns"("website");

-- CreateIndex
CREATE INDEX "checkupRuns_status_idx" ON "checkupRuns"("status");

-- CreateIndex
CREATE INDEX "checkupRuns_phase_idx" ON "checkupRuns"("phase");

-- CreateIndex
CREATE INDEX "checkupRunEvents_runId_createdAt_idx" ON "checkupRunEvents"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "checkupRunEvents_runId_sequence_idx" ON "checkupRunEvents"("runId", "sequence");

-- AddForeignKey
ALTER TABLE "checkupRuns" ADD CONSTRAINT "checkupRuns_resultKey_fkey" FOREIGN KEY ("resultKey") REFERENCES "checkupReports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkupRunEvents" ADD CONSTRAINT "checkupRunEvents_runId_fkey" FOREIGN KEY ("runId") REFERENCES "checkupRuns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
