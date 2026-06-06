-- Persist raw image usage plus derived per-run COGS for internal margin tracking.
ALTER TABLE "fix_runs" ADD COLUMN "imageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "fix_runs" ADD COLUMN "tokenCostCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "fix_runs" ADD COLUMN "sandboxCostCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "fix_runs" ADD COLUMN "imageCostCents" INTEGER NOT NULL DEFAULT 0;
