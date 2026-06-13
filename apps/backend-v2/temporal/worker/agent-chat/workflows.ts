import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";
import type { AgentChatWorkflowInput } from "./workflow-types";

const { runChatActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "60 minutes",
  retry: { maximumAttempts: 1 },
});

const { releaseChatLockActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
  retry: { maximumAttempts: 3 },
});

// One post-PR chat turn. The sandbox is kept alive (not torn down) so the
// conversation can continue.
export async function agentChatWorkflow(
  input: AgentChatWorkflowInput,
): Promise<void> {
  try {
    await runChatActivity(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await releaseChatLockActivity(input, message);
  }
}
