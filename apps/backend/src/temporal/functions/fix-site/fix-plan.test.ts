// Unit tests for buildFixPlan: checkup findings -> the agent's bounded, grouped task list.

import { test, expect } from "bun:test";
import { buildFixPlan } from "./fix-plan.ts";
import type { FindingScope, RubricFinding, Tier } from "../checkup/crawler/types.ts";

function finding(id: string, partial: Partial<RubricFinding> = {}): RubricFinding {
  const counts = partial.counts ?? { pass: 0, partial: 0, fail: 0, inconclusive: 0, notApplicable: 0 };
  return {
    id,
    category: partial.category ?? "Metadata",
    pillars: partial.pillars ?? ["seo"],
    tier: (partial.tier ?? "A") as Tier,
    fixableByAgent: partial.fixableByAgent ?? true,
    weight: partial.weight ?? 12,
    scope: (partial.scope ?? "per-page") as FindingScope,
    siteStatus: partial.siteStatus ?? "fail",
    counts,
    affectedCount: partial.affectedCount ?? counts.fail + counts.partial,
    representativeEvidence: partial.representativeEvidence ?? null,
    pages: partial.pages ?? [],
  };
}

test("site-wide checks go to siteWide, per-page checks to perPage", () => {
  const plan = buildFixPlan([
    finding("robots-ai-crawlers", { scope: "site-wide", counts: { pass: 0, partial: 0, fail: 1, inconclusive: 0, notApplicable: 0 } }),
    finding("definitions", { scope: "per-page", counts: { pass: 3, partial: 0, fail: 2, inconclusive: 0, notApplicable: 0 }, affectedCount: 2 }),
  ]);
  expect(plan.siteWide.map((t) => t.rubricId)).toEqual(["robots-ai-crawlers"]);
  expect(plan.perPage.map((t) => t.rubricId)).toEqual(["definitions"]);
});

test("a per-page check failing on EVERY page is upgraded to a site-wide template fix", () => {
  const plan = buildFixPlan([
    // meta-tags is per-page in the registry, but here it fails on all 5 applicable pages.
    finding("meta-tags", { scope: "per-page", counts: { pass: 0, partial: 0, fail: 5, inconclusive: 0, notApplicable: 0 }, affectedCount: 5 }),
  ]);
  expect(plan.siteWide.map((t) => t.rubricId)).toEqual(["meta-tags"]);
  expect(plan.perPage).toEqual([]);
  expect(plan.siteWide[0]!.scope).toBe("site-wide");
});

test("a per-page check failing on SOME pages stays per-page", () => {
  const plan = buildFixPlan([
    finding("meta-tags", { scope: "per-page", counts: { pass: 3, partial: 0, fail: 2, inconclusive: 0, notApplicable: 0 }, affectedCount: 2 }),
  ]);
  expect(plan.perPage.map((t) => t.rubricId)).toEqual(["meta-tags"]);
  expect(plan.siteWide).toEqual([]);
});

test("passing / not-applicable findings are excluded entirely", () => {
  const plan = buildFixPlan([
    finding("canonical-urls", { siteStatus: "pass", counts: { pass: 4, partial: 0, fail: 0, inconclusive: 0, notApplicable: 0 } }),
    finding("hreflang", { siteStatus: "not-applicable", counts: { pass: 0, partial: 0, fail: 0, inconclusive: 0, notApplicable: 4 } }),
  ]);
  expect(plan.totals.tasks).toBe(0);
  expect(plan.flagged).toEqual([]);
});

test("non-fixable / out-of-scope findings are flagged, never tasked", () => {
  const plan = buildFixPlan([
    finding("ssr-visibility", { tier: "out-of-scope", fixableByAgent: false, scope: "per-page", counts: { pass: 0, partial: 0, fail: 3, inconclusive: 0, notApplicable: 0 }, affectedCount: 3 }),
  ]);
  expect(plan.totals.tasks).toBe(0);
  expect(plan.flagged.map((f) => f.rubricId)).toEqual(["ssr-visibility"]);
  expect(plan.flagged[0]!.reason).toContain("out of scope");
});

test("each task references its skill file and carries the affected-page work list", () => {
  const plan = buildFixPlan([
    finding("definitions", {
      scope: "per-page",
      counts: { pass: 1, partial: 0, fail: 2, inconclusive: 0, notApplicable: 0 },
      affectedCount: 2,
      representativeEvidence: "src/content/x.mdx",
      pages: [
        { url: "https://x.com/a", status: "fail", evidence: "a.mdx" },
        { url: "https://x.com/b", status: "fail", evidence: "b.mdx" },
      ],
    }),
  ]);
  const t = plan.perPage[0]!;
  expect(t.skill).toBe("skills/definitions.md");
  expect(t.representativeEvidence).toBe("src/content/x.mdx");
  expect(t.pages).toHaveLength(2);
  expect(t.pages[0]).toEqual({ url: "https://x.com/a", status: "fail", evidence: "a.mdx" });
});

test("tasks are ordered highest-weight then most-affected; gated counts Tier C", () => {
  const plan = buildFixPlan([
    finding("low", { scope: "per-page", weight: 6, affectedCount: 1, counts: { pass: 5, partial: 0, fail: 1, inconclusive: 0, notApplicable: 0 } }),
    finding("high", { scope: "per-page", weight: 20, affectedCount: 1, counts: { pass: 5, partial: 0, fail: 1, inconclusive: 0, notApplicable: 0 } }),
    finding("tierc", { scope: "per-page", tier: "C", weight: 12, affectedCount: 2, counts: { pass: 0, partial: 0, fail: 2, inconclusive: 0, notApplicable: 0 } }),
  ]);
  expect(plan.perPage.map((t) => t.rubricId)).toEqual(["high", "tierc", "low"]);
  expect(plan.totals.gated).toBe(1);
  expect(plan.perPage.find((t) => t.rubricId === "tierc")!.gated).toBe(true);
});
