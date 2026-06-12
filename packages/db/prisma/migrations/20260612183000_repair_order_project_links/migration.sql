ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "scrapingId" TEXT;

CREATE INDEX IF NOT EXISTS "orders_projectId_idx" ON "orders"("projectId");
CREATE INDEX IF NOT EXISTS "orders_scrapingId_idx" ON "orders"("scrapingId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_projectId_fkey'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_projectId_fkey"
      FOREIGN KEY ("projectId")
      REFERENCES "projects"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_scrapingId_fkey'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_scrapingId_fkey"
      FOREIGN KEY ("scrapingId")
      REFERENCES "scrapings"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
