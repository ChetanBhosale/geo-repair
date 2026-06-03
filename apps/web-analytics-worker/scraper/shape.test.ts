// Verifies the ScoreReport JSON shape is stable: same keys whether a check has data or not,
// and identical top-level/category keys on a successful run vs an inconclusive (blocked) run.

import { test, expect } from "bun:test";
import { startScraping } from "./index.ts";
import { CATEGORIES, PILLARS, type ScoreReport } from "./types.ts";

const REPORT_KEYS = [
  "url", "finalUrl", "fetchedAt", "durationMs", "rubricVersion", "pageType",
  "fetch", "overall", "pillars", "categories", "checks", "advisories", "summary",
].sort();

const FETCH_KEYS = ["requestedUrl", "finalUrl", "status", "ok", "blocked", "blockReason", "tier"].sort();
const CHECK_KEYS = [
  "id", "category", "pillars", "tier", "fixableByAgent", "weight",
  "status", "reason", "good", "bad", "evidence", "fixHint",
].sort();
const ADVISORY_KEYS = ["id", "label", "status", "detail", "needs", "observed"].sort();
const SUMMARY_KEYS = ["good", "bad", "missing", "inconclusive"].sort();

/** Assert that a value round-trips through JSON with exactly the expected keys (no undefined drops). */
function assertJsonKeys(value: unknown, expected: string[]): void {
  const roundTripped = JSON.parse(JSON.stringify(value));
  expect(Object.keys(roundTripped).sort()).toEqual(expected);
}

function assertReportShape(report: ScoreReport): void {
  // Round-trip the whole thing first so we catch any undefined key drops.
  const json = JSON.parse(JSON.stringify(report)) as ScoreReport;

  expect(Object.keys(json).sort()).toEqual(REPORT_KEYS);
  assertJsonKeys(json.fetch, FETCH_KEYS);
  expect(Object.keys(json.pillars).sort()).toEqual([...PILLARS].sort());
  expect(Object.keys(json.categories).sort()).toEqual([...CATEGORIES].sort());
  assertJsonKeys(json.summary, SUMMARY_KEYS);

  for (const p of PILLARS) {
    assertJsonKeys(json.pillars[p], ["score", "earned", "applicable", "checks"].sort());
  }
  for (const cat of CATEGORIES) {
    assertJsonKeys(json.categories[cat], ["score", "earned", "applicable"].sort());
  }
  for (const c of json.checks) {
    assertJsonKeys(c, CHECK_KEYS); // evidence/fixHint present even when null
  }
  for (const a of json.advisories) {
    assertJsonKeys(a, ADVISORY_KEYS); // needs/observed present even when null
  }
}

test("successful report has the full stable key set", async () => {
  const report = await startScraping("https://example.com");
  expect(report.fetch.blocked).toBe(false);
  expect(report.checks.length).toBeGreaterThan(0);
  assertReportShape(report);
});

test("inconclusive (unreachable) report has the same top-level + category keys", async () => {
  const report = await startScraping("https://nonexistent-host-zzz-9d3f1a2b.dev");
  expect(report.fetch.blocked).toBe(true);
  expect(report.fetch.blockReason).not.toBeNull();
  // checks/advisories are empty arrays, but the keys still exist and categories are all present.
  assertReportShape(report);
});
