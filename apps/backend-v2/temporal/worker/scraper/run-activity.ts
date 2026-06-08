import { persistScrapeRun } from "./persist";
import { runScrape } from "./run";
import type { ScrapeResult } from "./types";
import type { ScrapeWorkflowInput } from "./workflow-types";

// Temporal activity: run the full scrape. When a scrapingId is provided it also
// persists logs + result + status to the DB (the API path). Without one it just
// runs and returns the result (ad-hoc). Each check is evaluated by its own
// check activity (see activities.ts). Identical scrape to the offline
// `bun run scraper` path.
export async function runScrapeActivity(
  input: ScrapeWorkflowInput,
): Promise<ScrapeResult> {
  if (input.scrapingId && input.userId && input.projectId) {
    return persistScrapeRun({
      scrapingId: input.scrapingId,
      userId: input.userId,
      projectId: input.projectId,
      websiteUrl: input.url,
      singlePage: input.singlePage,
      repo: input.repo ?? null,
    });
  }

  return runScrape(input.url, {
    singlePage: input.singlePage,
    repo: input.repo ?? null,
  });
}
