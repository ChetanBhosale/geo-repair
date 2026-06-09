import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";
import type { AgentPlanWorkflowInput } from "./workflow-types";

const { runPlannerAgentActivity } = proxyActivities<typeof activities>({
  // The agentic run clones the repo, inspects it with tools, and calls the
  // model many times, so give it room. No auto-retry: a retry would re-clone
  // and duplicate every chat log; on failure the activity marks the run FAILED.
  startToCloseTimeout: "20 minutes",
  retry: { maximumAttempts: 1 },
});

// Plan run: one agentic activity does create sandbox -> clone -> inspect + plan
// (streaming chat logs) -> persist -> kill sandbox. The fix run is a separate
// workflow started later when the user submits.
export async function agentPlanWorkflow(
  input: AgentPlanWorkflowInput,
): Promise<{ checks: number; manual: number }> {
  return runPlannerAgentActivity(input);
}
