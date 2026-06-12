-- Add a small reusable opt-in table for coming-soon product surfaces.
CREATE TYPE "FeatureInterestKey" AS ENUM ('AI_VISIBILITY');

CREATE TABLE "feature_interests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" "FeatureInterestKey" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_interests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_interests_userId_feature_key" ON "feature_interests"("userId", "feature");

CREATE INDEX "feature_interests_feature_idx" ON "feature_interests"("feature");

ALTER TABLE "feature_interests" ADD CONSTRAINT "feature_interests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
