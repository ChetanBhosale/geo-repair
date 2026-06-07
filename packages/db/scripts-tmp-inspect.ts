import { PrismaPg } from "@prisma/adapter-pg";
import secrets from "@repo/secrets/backend";
import { PrismaClient } from "./generated/prisma/client";

const adapter = new PrismaPg({ connectionString: secrets.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const rows = await prisma.$queryRawUnsafe<
  { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
>(
  `SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at`,
);
console.log("=== _prisma_migrations ===");
for (const r of rows) {
  console.log(
    `${r.migration_name}  finished=${r.finished_at ? "yes" : "NO"} rolledBack=${r.rolled_back_at ? "yes" : "no"}`,
  );
}

const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'repositories' AND column_name = 'website'`,
);
console.log("repositories.website exists:", cols.length > 0);

const plan = await prisma.$queryRawUnsafe<{ to_regclass: string | null }[]>(
  `SELECT to_regclass('public.plans') as to_regclass`,
);
console.log("plans table exists:", plan[0]?.to_regclass ?? null);

await prisma.$disconnect();
