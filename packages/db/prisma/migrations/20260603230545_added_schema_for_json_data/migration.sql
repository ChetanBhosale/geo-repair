-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuthProvider" ADD VALUE 'FRAMER';
ALTER TYPE "AuthProvider" ADD VALUE 'WORDPRESS';

-- CreateTable
CREATE TABLE "ScrapeGeo" (
    "id" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "websiteScrapeData" JSONB,
    "totalScrapeCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScrapeGeo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScrapeGeo_website_key" ON "ScrapeGeo"("website");
