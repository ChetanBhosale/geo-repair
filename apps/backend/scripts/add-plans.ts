// Seed / update the self-serve fix plan catalog (the `plans` table).
//
// Run with:  bun run add-plans         (from apps/backend)
//
// Idempotent: upserts one row per tier keyed by `tier`, so re-running updates
// prices/copy in place. Dodo product ids are read from env so the same script
// works across test/live. Existing orders are NOT touched: they snapshot their
// price at purchase time.
import { prisma } from "@repo/db";
import Secrets from "@repo/secrets/backend";

type SeedPlan = {
  tier: "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE_CUSTOM";
  name: string;
  maxPages: number | null;
  amountCents: number;
  currency: string;
  providerProductId: string | null;
  sortOrder: number;
  details: {
    page_cover: string;
    description: string;
    features: string[];
  };
};

const PLANS: SeedPlan[] = [
  {
    tier: "STARTER",
    name: "Starter",
    maxPages: 25,
    amountCents: 4900,
    currency: "USD",
    providerProductId: Secrets.DODO_PRODUCT_ID_STARTER ?? null,
    sortOrder: 0,
    details: {
      page_cover: "Up to 25 pages",
      description: "Best for a compact site or early launch.",
      features: ["One-click fix PR", "Build-passing changes", "AI search readiness"],
    },
  },
  {
    tier: "GROWTH",
    name: "Growth",
    maxPages: 100,
    amountCents: 14900,
    currency: "USD",
    providerProductId: Secrets.DODO_PRODUCT_ID_GROWTH ?? null,
    sortOrder: 1,
    details: {
      page_cover: "Up to 100 pages",
      description: "Best for a normal marketing site with key service pages.",
      features: ["Everything in Starter", "Larger page coverage", "Priority fixes"],
    },
  },
  {
    tier: "SCALE",
    name: "Scale",
    maxPages: 250,
    amountCents: 39900,
    currency: "USD",
    providerProductId: Secrets.DODO_PRODUCT_ID_SCALE ?? null,
    sortOrder: 2,
    details: {
      page_cover: "Up to 250 pages",
      description: "Best for larger content libraries and multi-page sites.",
      features: ["Everything in Growth", "Highest page coverage", "Multi-page sites"],
    },
  },
  {
    tier: "ENTERPRISE_CUSTOM",
    name: "Enterprise",
    maxPages: null,
    amountCents: 0,
    currency: "USD",
    providerProductId: null,
    sortOrder: 3,
    details: {
      page_cover: "250+ pages",
      description: "For sites that need manual scoping before checkout.",
      features: ["Custom scoping", "Manual quote", "Dedicated support"],
    },
  },
];

async function main() {
  for (const plan of PLANS) {
    const result = await prisma.plan.upsert({
      where: { tier: plan.tier },
      create: {
        tier: plan.tier,
        name: plan.name,
        maxPages: plan.maxPages,
        amountCents: plan.amountCents,
        currency: plan.currency,
        providerProductId: plan.providerProductId,
        sortOrder: plan.sortOrder,
        active: true,
        details: plan.details,
      },
      update: {
        name: plan.name,
        maxPages: plan.maxPages,
        amountCents: plan.amountCents,
        currency: plan.currency,
        providerProductId: plan.providerProductId,
        sortOrder: plan.sortOrder,
        details: plan.details,
      },
    });
    const price =
      result.amountCents > 0
        ? `${(result.amountCents / 100).toFixed(2)} ${result.currency}`
        : "custom";
    const productNote = result.providerProductId
      ? result.providerProductId
      : "no product id (contact sales)";
    console.log(`✓ ${result.tier.padEnd(18)} ${price.padEnd(12)} ${productNote}`);
  }
  console.log(`\nSeeded ${PLANS.length} plans.`);
}

main()
  .catch((err) => {
    console.error("Failed to seed plans:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
