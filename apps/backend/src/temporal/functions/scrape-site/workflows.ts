import { proxyActivities } from "@temporalio/workflow";
import type { ScrapeSiteInput, ScrapeSiteResult } from "../../shared";
import type * as activities from "./activities";

const { runAudit } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: { maximumAttempts: 3 },
});

export async function scrapeSiteWorkflow(
  input: ScrapeSiteInput
): Promise<ScrapeSiteResult> {
  return runAudit(input);
}
