ALTER TABLE "feature_interests" ADD COLUMN "projectId" TEXT;

CREATE INDEX "feature_interests_projectId_idx" ON "feature_interests"("projectId");

ALTER TABLE "feature_interests"
  ADD CONSTRAINT "feature_interests_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
