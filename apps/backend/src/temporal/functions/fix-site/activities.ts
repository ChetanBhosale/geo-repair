import type { FixSiteInput, FixSiteResult } from "../../shared";
import { scrapeSite } from "../scrape-site/scraper";
import { buildFixPlan, type FixPlan } from "./fix-plan";

/**
 * Build the agent's fix plan for a site: run a FRESH authoritative full scan (the free checkup's
 * sample only drove the quote), then group the rubric findings into site-wide vs per-page tasks.
 * Pure of any agent/sandbox concern, so the control plane can also call it to preview "what we'll
 * fix" before a run. The agent then loads skills/<rubricId>.md for each task.
 */
export async function planSiteFix(input: FixSiteInput): Promise<FixPlan> {
  const report = await scrapeSite(input.website);
  return buildFixPlan(report.findings, { pagesScanned: report.crawl.pagesScraped });
}

// Activities for the fix-site queue.
//
// The planning half (scan -> grouped task list) is implemented. The execution half — spin up an
// E2B sandbox, drive opencode with the per-rubric skills, run build/type-check, open the PR — is
// the next build step (P3). Until then this fails loudly with the plan it built, rather than
// pretending to open a PR.
export async function fixSite(input: FixSiteInput): Promise<FixSiteResult> {
  const plan = await planSiteFix(input);
  const { siteWide, perPage, gated } = plan.totals;
  throw new Error(
    `fix agent runner not implemented yet (E2B + opencode). Built fix plan for ${input.website}: ` +
      `${siteWide} site-wide + ${perPage} per-page task(s)` +
      (gated ? `, ${gated} gated (Tier C, need approval)` : "") +
      (plan.flagged.length ? `, ${plan.flagged.length} flagged for manual work` : "") +
      ".",
  );
}
