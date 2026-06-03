/*
  Warnings:

  - You are about to drop the `ScrapeGeo` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "ScrapeGeo";

-- CreateTable
CREATE TABLE "scrapeGeo" (
    "id" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "websiteScrapeData" JSONB,
    "totalScrapeCount" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "origin" TEXT,
    "singlePage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrapeGeo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scrapeGeo_website_key" ON "scrapeGeo"("website");

-- CreateIndex
CREATE INDEX "scrapeGeo_website_idx" ON "scrapeGeo"("website");
