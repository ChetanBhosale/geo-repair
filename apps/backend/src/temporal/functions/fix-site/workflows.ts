import { proxyActivities } from "@temporalio/workflow";
import type { FixSiteInput, FixSiteResult } from "../../shared";
import type * as activities from "./activities";

const { fixSite } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 minutes",
});

export async function fixSiteWorkflow(input: FixSiteInput): Promise<FixSiteResult> {
  return fixSite(input);
}
