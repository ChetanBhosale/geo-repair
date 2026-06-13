ALTER TABLE "projects" ADD COLUMN "slug" TEXT;
ALTER TABLE "scrapings" ADD COLUMN "slug" TEXT;
ALTER TABLE "agent_runs" ADD COLUMN "slug" TEXT;

WITH project_base AS (
  SELECT
    "id",
    "userId",
    COALESCE(
      NULLIF(
        TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(COALESCE(NULLIF("name", ''), "id")), '[^a-z0-9]+', '-', 'g')),
        ''
      ),
      'project'
    ) AS base,
    "updatedAt"
  FROM "projects"
),
project_reserved AS (
  SELECT
    "id",
    "userId",
    CASE
      WHEN base IN ('account', 'api', 'new', 'projects', 'purchase', 'settings', 'support')
        THEN base || '-project'
      ELSE base
    END AS base,
    "updatedAt"
  FROM project_base
),
project_numbered AS (
  SELECT
    "id",
    base,
    ROW_NUMBER() OVER (PARTITION BY "userId", base ORDER BY "updatedAt" DESC, "id" ASC) AS rn
  FROM project_reserved
)
UPDATE "projects" p
SET "slug" = CASE
  WHEN pn.rn = 1 THEN pn.base
  ELSE pn.base || '-' || pn.rn::TEXT
END
FROM project_numbered pn
WHERE p."id" = pn."id";

WITH scraping_numbered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt" ASC, "id" ASC) AS rn
  FROM "scrapings"
)
UPDATE "scrapings" s
SET "slug" = 'scan-' || sn.rn::TEXT
FROM scraping_numbered sn
WHERE s."id" = sn."id";

WITH agent_numbered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt" ASC, "id" ASC) AS rn
  FROM "agent_runs"
)
UPDATE "agent_runs" a
SET "slug" = 'fix-' || an.rn::TEXT
FROM agent_numbered an
WHERE a."id" = an."id";

UPDATE "projects" SET "slug" = 'project-' || "id" WHERE "slug" IS NULL;
UPDATE "scrapings" SET "slug" = 'scan-' || "id" WHERE "slug" IS NULL;
UPDATE "agent_runs" SET "slug" = 'fix-' || "id" WHERE "slug" IS NULL;

ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "scrapings" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "agent_runs" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "projects_userId_slug_key" ON "projects"("userId", "slug");
CREATE UNIQUE INDEX "scrapings_projectId_slug_key" ON "scrapings"("projectId", "slug");
CREATE UNIQUE INDEX "agent_runs_projectId_slug_key" ON "agent_runs"("projectId", "slug");

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "selected" DESC, "updatedAt" DESC, "id" ASC) AS rn
  FROM "projects"
)
UPDATE "projects" p
SET "selected" = ranked.rn = 1
FROM ranked
WHERE p."id" = ranked."id";
