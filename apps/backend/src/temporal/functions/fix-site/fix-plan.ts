// buildFixPlan: turn rubric-centric checkup findings into the fix agent's bounded task list.
//
// This is the bridge between the checkup findings (RubricFinding[]) and the agent run. It is keyed on the
// ~23 rubric checks, NOT on pages, so the agent's input is bounded by check count, never page
// count, turning "fix 1000 pages" into "a few site-wide fixes + a handful of per-page edits".
//
// Two buckets:
//   - siteWide: fix one shared file/template (robots, sitemap, llms.txt, <head>/layout) → repairs
//     every affected page in one edit. Includes per-page checks that fail on EVERY page (the same
//     template gap), upgraded here so we never fan out N identical edits.
//   - perPage:  genuine route-specific content fixes (answerability, definitions, per-page gaps).
//
// Each task maps to the agent skill at skills/<rubricId>.md (see @repo/agent/skills). Findings
// that are not agent-fixable (out-of-scope / flag-only) are surfaced under `flagged` for the PR's
// "Flagged for manual work" section, never silently dropped.

import { isCentralizable } from "../checkup/crawler/checks.ts";
import type {
  Category,
  FindingScope,
  Pillar,
  RubricFinding,
  Status,
  Tier,
} from "../checkup/crawler/types.ts";

export interface FixTaskPage {
  url: string;
  status: Status;
  evidence: string | null;
}

export interface FixTask {
  /** The check id — also the skill the agent loads (skills/<rubricId>.md). */
  rubricId: string;
  /** Path the agent reads in-sandbox for this check's fix instructions. */
  skill: string;
  category: Category;
  pillars: Pillar[];
  tier: Tier;
  weight: number;
  /** Effective scope after the "fails on every page -> fix the template once" upgrade. */
  scope: FindingScope;
  /** Roll-up status of the check across the site (mixed = some pass, some fail/partial). */
  siteStatus: "fail" | "partial" | "mixed";
  /** Exact count of pages failing or partial for this check. */
  affectedCount: number;
  /** Representative offending file/route — the starting clue for a site-wide fix. */
  representativeEvidence: string | null;
  /** Tier C (net-new content) needs explicit approval + intake before the agent acts. */
  gated: boolean;
  /** Capped sample of affected pages — the work list for per-page tasks, informational for site-wide. */
  pages: FixTaskPage[];
}

export interface FlaggedFinding {
  rubricId: string;
  siteStatus: RubricFinding["siteStatus"];
  affectedCount: number;
  /** Why the agent won't auto-fix it (out of scope / not agent-fixable). */
  reason: string;
}

export interface FixPlan {
  /** One shared/template fix each — applied once, repairs every affected page. */
  siteWide: FixTask[];
  /** Genuine per-page content fixes — the bounded fan-out. */
  perPage: FixTask[];
  /** Non-fixable findings surfaced for the PR's "Flagged for manual work". */
  flagged: FlaggedFinding[];
  totals: { tasks: number; siteWide: number; perPage: number; gated: number };
}

export interface BuildFixPlanOptions {
  /**
   * Readable pages checked. Unused directly today (each finding carries its own applicable count),
   * reserved so callers can pass checkup context without an API change.
   */
  pagesChecked?: number;
}

/** A finding is worth acting on when it failed or partially failed somewhere. */
function isActionable(status: RubricFinding["siteStatus"]): status is "fail" | "partial" | "mixed" {
  return status === "fail" || status === "partial" || status === "mixed";
}

export function buildFixPlan(findings: RubricFinding[], _opts: BuildFixPlanOptions = {}): FixPlan {
  const siteWide: FixTask[] = [];
  const perPage: FixTask[] = [];
  const flagged: FlaggedFinding[] = [];

  for (const f of findings) {
    if (!isActionable(f.siteStatus)) continue;

    if (!f.fixableByAgent || f.tier === "out-of-scope") {
      flagged.push({
        rubricId: f.id,
        siteStatus: f.siteStatus,
        affectedCount: f.affectedCount,
        reason: f.tier === "out-of-scope" ? "out of scope (flag only)" : "not agent-fixable",
      });
      continue;
    }

    // Upgrade a CENTRALIZABLE per-page check (head/metadata) that fails/partials on every
    // applicable page to a single site-wide template fix. It is the same shared gap, so do not fan
    // out N identical edits. Content checks (alt text, definitions, …) never upgrade: each page
    // needs its own edit even when they fail everywhere.
    const applicable = f.counts.pass + f.counts.partial + f.counts.fail;
    const failsEverywhere = applicable > 1 && f.affectedCount === applicable;
    const scope: FindingScope =
      f.scope === "site-wide" || (isCentralizable(f.id) && failsEverywhere) ? "site-wide" : "per-page";

    const task: FixTask = {
      rubricId: f.id,
      skill: `skills/${f.id}.md`,
      category: f.category,
      pillars: f.pillars,
      tier: f.tier,
      weight: f.weight,
      scope,
      siteStatus: f.siteStatus,
      affectedCount: f.affectedCount,
      representativeEvidence: f.representativeEvidence,
      gated: f.tier === "C",
      pages: f.pages.map((p) => ({ url: p.url, status: p.status, evidence: p.evidence })),
    };

    (scope === "site-wide" ? siteWide : perPage).push(task);
  }

  // Highest weight first, then most-affected — matches the agent's "process highest-weight first".
  const byPriority = (a: FixTask, b: FixTask) => b.weight - a.weight || b.affectedCount - a.affectedCount;
  siteWide.sort(byPriority);
  perPage.sort(byPriority);

  const gated = [...siteWide, ...perPage].filter((t) => t.gated).length;

  return {
    siteWide,
    perPage,
    flagged,
    totals: { tasks: siteWide.length + perPage.length, siteWide: siteWide.length, perPage: perPage.length, gated },
  };
}
