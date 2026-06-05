// Roll per-check results into pillar + category subscores and an overall score.
// Formula + status->points + pillar weights are canonical in /scraper.md section 3.

import {
  CATEGORIES,
  PILLARS,
  type CheckResult,
  type Pillar,
  type PillarScore,
  type CategoryScore,
  type Category,
  type Status,
  type ScoreReport,
} from "./types.ts";

// Default pillar weights (/scraper.md section 3). Sum to 1.
export const PILLAR_WEIGHTS: Record<Pillar, number> = {
  geo: 0.4,
  aeo: 0.35,
  seo: 0.25,
};

/** status -> fraction of weight earned. inconclusive/not-applicable excluded from denominator. */
function statusFraction(status: Status): number | null {
  switch (status) {
    case "pass":
      return 1;
    case "partial":
      return 0.5;
    case "fail":
      return 0;
    case "inconclusive":
    case "not-applicable":
      return null; // excluded
  }
}

function weightedPct(checks: CheckResult[]): {
  score: number;
  earned: number;
  applicable: number;
  count: number;
} {
  let earned = 0;
  let applicable = 0;
  let count = 0;
  for (const c of checks) {
    const frac = statusFraction(c.status);
    if (frac === null) continue;
    applicable += c.weight;
    earned += c.weight * frac;
    count += 1;
  }
  const score = applicable > 0 ? Math.round((earned / applicable) * 100) : 0;
  return { score, earned: Math.round(earned), applicable, count };
}

export function scorePillars(
  checks: CheckResult[],
): Record<Pillar, PillarScore> {
  const out = {} as Record<Pillar, PillarScore>;
  for (const p of PILLARS) {
    const members = checks.filter((c) => c.pillars.includes(p));
    const { score, earned, applicable, count } = weightedPct(members);
    out[p] = { score, earned, applicable, checks: count };
  }
  return out;
}

/** Always emits every canonical category key; a category with no applicable checks scores 0. */
export function scoreCategories(
  checks: CheckResult[],
): Record<Category, CategoryScore> {
  const out = {} as Record<Category, CategoryScore>;
  for (const cat of CATEGORIES) {
    const members = checks.filter((c) => c.category === cat);
    const { score, earned, applicable } = weightedPct(members);
    out[cat] = { score, earned, applicable };
  }
  return out;
}

export function overallScore(pillars: Record<Pillar, PillarScore>): number {
  // Re-normalize across pillars that actually had applicable checks.
  let weightSum = 0;
  let acc = 0;
  for (const p of ["seo", "geo", "aeo"] as Pillar[]) {
    if (pillars[p].applicable > 0) {
      acc += PILLAR_WEIGHTS[p] * pillars[p].score;
      weightSum += PILLAR_WEIGHTS[p];
    }
  }
  return weightSum > 0 ? Math.round(acc / weightSum) : 0;
}

/** Build the customer-facing good/bad/missing/inconclusive rollup from all checks. */
export function buildSummary(checks: CheckResult[]): ScoreReport["summary"] {
  const good: string[] = [];
  const bad: string[] = [];
  const missing: string[] = [];
  const inconclusive: string[] = [];

  for (const c of checks) {
    if (c.status === "pass") {
      good.push(`${c.id}: ${c.reason}`);
    } else if (c.status === "fail") {
      // "missing" = nothing there; "bad" = present but wrong. Use evidence/bad to disambiguate.
      const looksMissing = c.bad.some((b) =>
        /missing|no |not found|none|empty/i.test(b),
      );
      (looksMissing ? missing : bad).push(`${c.id}: ${c.reason}`);
    } else if (c.status === "partial") {
      bad.push(`${c.id}: ${c.reason}`);
    } else {
      inconclusive.push(`${c.id}: ${c.reason}`);
    }
  }
  return { good, bad, missing, inconclusive };
}
