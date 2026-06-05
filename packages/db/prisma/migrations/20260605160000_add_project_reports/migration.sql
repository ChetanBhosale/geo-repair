-- CreateEnum
CREATE TYPE "ProjectReportType" AS ENUM ('SCAN', 'FIX_SUMMARY', 'BEFORE_AFTER', 'EXPORT');

-- CreateEnum
CREATE TYPE "ProjectReportStatus" AS ENUM ('READY', 'DRAFT', 'FAILED');

-- CreateTable
CREATE TABLE "project_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ProjectReportType" NOT NULL,
    "status" "ProjectReportStatus" NOT NULL DEFAULT 'READY',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "website" TEXT,
    "repoFullName" TEXT,
    "checkupReportId" TEXT,
    "fixRunId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_share_links" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_reports_sourceKey_key" ON "project_reports"("sourceKey");

-- CreateIndex
CREATE INDEX "project_reports_userId_type_idx" ON "project_reports"("userId", "type");

-- CreateIndex
CREATE INDEX "project_reports_checkupReportId_idx" ON "project_reports"("checkupReportId");

-- CreateIndex
CREATE INDEX "project_reports_fixRunId_idx" ON "project_reports"("fixRunId");

-- CreateIndex
CREATE UNIQUE INDEX "report_share_links_token_key" ON "report_share_links"("token");

-- CreateIndex
CREATE INDEX "report_share_links_reportId_idx" ON "report_share_links"("reportId");

-- CreateIndex
CREATE INDEX "report_share_links_userId_idx" ON "report_share_links"("userId");

-- CreateIndex
CREATE INDEX "report_share_links_token_idx" ON "report_share_links"("token");

-- AddForeignKey
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_checkupReportId_fkey" FOREIGN KEY ("checkupReportId") REFERENCES "checkupReports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_fixRunId_fkey" FOREIGN KEY ("fixRunId") REFERENCES "fix_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_share_links" ADD CONSTRAINT "report_share_links_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "project_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_share_links" ADD CONSTRAINT "report_share_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
