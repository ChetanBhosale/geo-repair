import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./run-activity";
import type { ScrapeResult } from "./types";
import type { ScrapeWorkflowInput } from "./workflow-types";

// Each activity retries up to 3 times (per the run plan).
const { runScrapeActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 minutes",
  retry: { maximumAttempts: 3 },
});

export async function scrapeWorkflow(
  input: ScrapeWorkflowInput,
): Promise<ScrapeResult> {
  return runScrapeActivity(input);
}
