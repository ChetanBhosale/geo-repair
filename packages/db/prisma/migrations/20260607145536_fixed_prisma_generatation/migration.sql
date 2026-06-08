/*
  Warnings:

  - You are about to drop the `checkupReports` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `checkupRunEvents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `checkupRuns` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `fix_checks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `fix_runs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `orders` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `paymentWebhookEvents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `plans` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `project_reports` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `report_share_links` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `repositories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `run_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `scan_usage` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,provider]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "checkupRunEvents" DROP CONSTRAINT "checkupRunEvents_runId_fkey";

-- DropForeignKey
ALTER TABLE "checkupRuns" DROP CONSTRAINT "checkupRuns_resultKey_fkey";

-- DropForeignKey
ALTER TABLE "fix_checks" DROP CONSTRAINT "fix_checks_fixRunId_fkey";

-- DropForeignKey
ALTER TABLE "fix_runs" DROP CONSTRAINT "fix_runs_orderId_fkey";

-- DropForeignKey
ALTER TABLE "fix_runs" DROP CONSTRAINT "fix_runs_repositoryId_fkey";

-- DropForeignKey
ALTER TABLE "fix_runs" DROP CONSTRAINT "fix_runs_userId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_checkupReportId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_planId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_userId_fkey";

-- DropForeignKey
ALTER TABLE "paymentWebhookEvents" DROP CONSTRAINT "paymentWebhookEvents_orderId_fkey";

-- DropForeignKey
ALTER TABLE "project_reports" DROP CONSTRAINT "project_reports_checkupReportId_fkey";

-- DropForeignKey
ALTER TABLE "project_reports" DROP CONSTRAINT "project_reports_fixRunId_fkey";

-- DropForeignKey
ALTER TABLE "project_reports" DROP CONSTRAINT "project_reports_userId_fkey";

-- DropForeignKey
ALTER TABLE "report_share_links" DROP CONSTRAINT "report_share_links_reportId_fkey";

-- DropForeignKey
ALTER TABLE "report_share_links" DROP CONSTRAINT "report_share_links_userId_fkey";

-- DropForeignKey
ALTER TABLE "repositories" DROP CONSTRAINT "repositories_accountId_fkey";

-- DropForeignKey
ALTER TABLE "repositories" DROP CONSTRAINT "repositories_userId_fkey";

-- DropForeignKey
ALTER TABLE "run_events" DROP CONSTRAINT "run_events_fixRunId_fkey";

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "accessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "githubInstallationId" BIGINT,
ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "tokenType" TEXT,
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "checkupReports";

-- DropTable
DROP TABLE "checkupRunEvents";

-- DropTable
DROP TABLE "checkupRuns";

-- DropTable
DROP TABLE "fix_checks";

-- DropTable
DROP TABLE "fix_runs";

-- DropTable
DROP TABLE "orders";

-- DropTable
DROP TABLE "paymentWebhookEvents";

-- DropTable
DROP TABLE "plans";

-- DropTable
DROP TABLE "project_reports";

-- DropTable
DROP TABLE "report_share_links";

-- DropTable
DROP TABLE "repositories";

-- DropTable
DROP TABLE "run_events";

-- DropTable
DROP TABLE "scan_usage";

-- DropEnum
DROP TYPE "FixCheckStatus";

-- DropEnum
DROP TYPE "FixRunState";

-- DropEnum
DROP TYPE "OrderKind";

-- DropEnum
DROP TYPE "OrderResolutionState";

-- DropEnum
DROP TYPE "OrderStatus";

-- DropEnum
DROP TYPE "OrderTier";

-- DropEnum
DROP TYPE "PaymentProvider";

-- DropEnum
DROP TYPE "ProjectReportStatus";

-- DropEnum
DROP TYPE "ProjectReportType";

-- DropEnum
DROP TYPE "SandboxStatus";

-- DropEnum
DROP TYPE "ScanUsageScope";

-- DropEnum
DROP TYPE "WebhookProcessingStatus";

-- CreateIndex
CREATE UNIQUE INDEX "accounts_userId_provider_key" ON "accounts"("userId", "provider");
