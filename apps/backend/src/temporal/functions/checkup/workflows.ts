import { proxyActivities } from "@temporalio/workflow";
import type { CheckupInput, CheckupResult } from "../../shared";
import type * as activities from "./activities";

const { runCheckup } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 minutes",
  retry: { maximumAttempts: 3 },
});

export async function checkupWorkflow(
  input: CheckupInput,
): Promise<CheckupResult> {
  return runCheckup(input);
}
