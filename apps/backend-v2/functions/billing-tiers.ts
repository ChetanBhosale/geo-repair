import Secrets from "@repo/secrets/backend";
import type { FixTier, PlanSummary } from "@repo/types/billing";

export type FixTierConfig = {
  tier: FixTier;
  name: string;
  amountCents: number;
  currency: string;
  maxPages: number | null;
  sortOrder: number;
  selfServe: boolean;
  productId?: string;
  description: string;
  features: string[];
};

const FIX_TIER_RANK: Record<FixTier, number> = {
  STARTER: 0,
  GROWTH: 1,
  SCALE: 2,
  ENTERPRISE_CUSTOM: 3,
};

export class BillingError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

export const FIX_TIER_CONFIGS: FixTierConfig[] = [
  {
    tier: "STARTER",
    name: "Starter",
    amountCents: 4900,
    currency: "USD",
    maxPages: 25,
    sortOrder: 0,
    selfServe: true,
    productId: Secrets.DODO_PRODUCT_ID_STARTER,
    description: "One-time AI Search Fix for small sites.",
    features: ["Up to 25 pages", "One reviewable fix PR", "Final re-scan"],
  },
  {
    tier: "GROWTH",
    name: "Growth",
    amountCents: 14900,
    currency: "USD",
    maxPages: 100,
    sortOrder: 1,
    selfServe: true,
    productId: Secrets.DODO_PRODUCT_ID_GROWTH,
    description: "One-time AI Search Fix for most founder sites.",
    features: ["Up to 100 pages", "One reviewable fix PR", "Final re-scan"],
  },
  {
    tier: "SCALE",
    name: "Scale",
    amountCents: 39900,
    currency: "USD",
    maxPages: 250,
    sortOrder: 2,
    selfServe: true,
    productId: Secrets.DODO_PRODUCT_ID_SCALE,
    description: "One-time AI Search Fix for larger content sites.",
    features: ["Up to 250 pages", "One reviewable fix PR", "Final re-scan"],
  },
  {
    tier: "ENTERPRISE_CUSTOM",
    name: "Enterprise",
    amountCents: 0,
    currency: "USD",
    maxPages: null,
    sortOrder: 3,
    selfServe: false,
    description: "Custom quote for sites above 250 pages.",
    features: ["250+ pages", "Contact only", "No automated checkout"],
  },
];

export function planSummaries(): PlanSummary[] {
  return FIX_TIER_CONFIGS.map((tier) => ({
    id: tier.tier,
    tier: tier.tier,
    name: tier.name,
    amountCents: tier.amountCents,
    currency: tier.currency,
    maxPages: tier.maxPages,
    sortOrder: tier.sortOrder,
    selfServe: tier.selfServe,
    pageCover: tier.maxPages ? `Up to ${tier.maxPages} pages` : "250+ pages",
    description: tier.description,
    features: tier.features,
  }));
}

export function getFixTierForPageCount(pageCount: number): FixTierConfig {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new BillingError(400, "sitemapPageCount must be a positive integer.");
  }

  const tier = FIX_TIER_CONFIGS.find(
    (candidate) =>
      candidate.maxPages !== null && pageCount <= candidate.maxPages,
  );

  return tier ?? FIX_TIER_CONFIGS[3]!;
}

export function getFixTierByName(tier: FixTier): FixTierConfig {
  const config = FIX_TIER_CONFIGS.find((candidate) => candidate.tier === tier);
  if (!config) throw new BillingError(400, "Unknown pricing tier.");
  return config;
}

export function getFixTierForSelection(
  sitemapPageCount: number,
  selectedTier?: FixTier,
): FixTierConfig {
  const applicableTier = getFixTierForPageCount(sitemapPageCount);
  const requestedTier = selectedTier
    ? getFixTierByName(selectedTier)
    : applicableTier;

  if (FIX_TIER_RANK[requestedTier.tier] < FIX_TIER_RANK[applicableTier.tier]) {
    throw new BillingError(
      400,
      "Selected tier cannot be lower than the tier required by the scan.",
    );
  }

  return requestedTier;
}

export function requireProductId(tier: FixTierConfig): string {
  if (!tier.selfServe || tier.tier === "ENTERPRISE_CUSTOM") {
    throw new BillingError(400, "Custom plans require a sales conversation.");
  }

  if (!tier.productId) {
    throw new BillingError(
      500,
      `Missing Dodo product id for ${tier.tier.toLowerCase()} tier.`,
    );
  }

  return tier.productId;
}
