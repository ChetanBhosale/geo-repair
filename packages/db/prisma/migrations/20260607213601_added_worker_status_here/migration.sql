-- CreateEnum
CREATE TYPE "WorkerService" AS ENUM ('SCRAPING', 'AGENT');

-- CreateTable
CREATE TABLE "worker_status" (
    "id" TEXT NOT NULL,
    "service" "WorkerService" NOT NULL,
    "status" "ScrapingStatus" NOT NULL DEFAULT 'QUEUED',
    "temporalWorkflowId" TEXT,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "scrapingId" TEXT,
    "title" TEXT,
    "progress" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "worker_status_temporalWorkflowId_key" ON "worker_status"("temporalWorkflowId");

-- CreateIndex
CREATE UNIQUE INDEX "worker_status_scrapingId_key" ON "worker_status"("scrapingId");

-- CreateIndex
CREATE INDEX "worker_status_userId_status_idx" ON "worker_status"("userId", "status");

-- CreateIndex
CREATE INDEX "worker_status_projectId_idx" ON "worker_status"("projectId");

-- AddForeignKey
ALTER TABLE "worker_status" ADD CONSTRAINT "worker_status_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_status" ADD CONSTRAINT "worker_status_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_status" ADD CONSTRAINT "worker_status_scrapingId_fkey" FOREIGN KEY ("scrapingId") REFERENCES "scrapings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
