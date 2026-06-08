import type { CheckCategory } from "./check-intent";
import type {
  CategoryScoreOut,
  CheckResultOut,
  CheckStatus,
} from "./types";

const CATEGORIES: CheckCategory[] = [
  "Rendering",
  "Structured data",
  "Metadata",
  "Crawl surface",
  "Semantics",
  "Content",
  "Answerability",
];

// 0-100 -> SUCCESS / MID / FAILED band.
export function bandFor(score: number): CheckStatus {
  if (score >= 80) return "SUCCESS";
  if (score >= 50) return "MID";
  return "FAILED";
}

function rollup(checks: CheckResultOut[]) {
  let earned = 0;
  let possible = 0;
  for (const c of checks) {
    earned += c.pointsEarned;
    possible += c.pointsPossible;
  }
  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  return { earned, possible, score };
}

export function scoreChecks(checks: CheckResultOut[]) {
  const overall = rollup(checks);

  const byCategory = {} as Record<CheckCategory, CategoryScoreOut>;
  for (const cat of CATEGORIES) {
    const members = checks.filter((c) => c.category === cat);
    const r = rollup(members);
    byCategory[cat] = {
      score: r.score,
      status: r.possible > 0 ? bandFor(r.score) : "NOT_APPLICABLE",
      pointsEarned: r.earned,
      pointsPossible: r.possible,
    };
  }

  return {
    overall: overall.score,
    status: bandFor(overall.score),
    pointsEarned: overall.earned,
    pointsPossible: overall.possible,
    byCategory,
  };
}
