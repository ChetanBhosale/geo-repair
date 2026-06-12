import { describe, expect, test } from "bun:test";

import {
  BillingError,
  FIX_TIER_CONFIGS,
  getFixTierForPageCount,
  getFixTierForSelection,
  planSummaries,
  requireProductId,
} from "./billing-tiers";

describe("billing tiers", () => {
  test("keeps the v1 one-time pricing catalog", () => {
    expect(
      planSummaries().map((plan) => ({
        tier: plan.tier,
        amountCents: plan.amountCents,
        maxPages: plan.maxPages,
        selfServe: plan.selfServe,
      })),
    ).toEqual([
      {
        tier: "STARTER",
        amountCents: 4900,
        maxPages: 25,
        selfServe: true,
      },
      {
        tier: "GROWTH",
        amountCents: 14900,
        maxPages: 100,
        selfServe: true,
      },
      {
        tier: "SCALE",
        amountCents: 39900,
        maxPages: 250,
        selfServe: true,
      },
      {
        tier: "ENTERPRISE_CUSTOM",
        amountCents: 0,
        maxPages: null,
        selfServe: false,
      },
    ]);
  });

  test("selects the checkout tier from inclusive page-count bounds", () => {
    expect(getFixTierForPageCount(1).tier).toBe("STARTER");
    expect(getFixTierForPageCount(25).tier).toBe("STARTER");
    expect(getFixTierForPageCount(26).tier).toBe("GROWTH");
    expect(getFixTierForPageCount(100).tier).toBe("GROWTH");
    expect(getFixTierForPageCount(101).tier).toBe("SCALE");
    expect(getFixTierForPageCount(250).tier).toBe("SCALE");
    expect(getFixTierForPageCount(251).tier).toBe("ENTERPRISE_CUSTOM");
  });

  test("rejects invalid page counts", () => {
    for (const pageCount of [0, -1, 1.5, Number.NaN]) {
      expect(() => getFixTierForPageCount(pageCount)).toThrow(BillingError);
    }
  });

  test("does not allow a selected tier below the scanned page count", () => {
    expect(() => getFixTierForSelection(80, "STARTER")).toThrow(BillingError);
    expect(getFixTierForSelection(80, "GROWTH").tier).toBe("GROWTH");
    expect(getFixTierForSelection(80, "SCALE").tier).toBe("SCALE");
  });

  test("keeps enterprise as contact-only, not automated checkout", () => {
    const enterprise = FIX_TIER_CONFIGS.find(
      (tier) => tier.tier === "ENTERPRISE_CUSTOM",
    );

    expect(enterprise).toBeDefined();
    expect(enterprise?.selfServe).toBe(false);
    expect(() => requireProductId(enterprise!)).toThrow(BillingError);
  });
});
