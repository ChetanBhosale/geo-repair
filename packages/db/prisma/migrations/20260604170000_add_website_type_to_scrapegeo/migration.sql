-- AlterTable
ALTER TABLE "scrapeGeo" ADD COLUMN "websiteType" TEXT;

-- CreateIndex
CREATE INDEX "scrapeGeo_websiteType_idx" ON "scrapeGeo"("websiteType");
