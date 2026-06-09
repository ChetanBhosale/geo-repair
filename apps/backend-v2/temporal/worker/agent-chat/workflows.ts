import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";
import type { AgentChatWorkflowInput } from "./workflow-types";

const { runChatActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 minutes",
  retry: { maximumAttempts: 1 },
});

// One post-PR chat turn. The sandbox is kept alive (not torn down) so the
// conversation can continue.
export async function agentChatWorkflow(input: AgentChatWorkflowInput): Promise<void> {
  return runChatActivity(input);
}
