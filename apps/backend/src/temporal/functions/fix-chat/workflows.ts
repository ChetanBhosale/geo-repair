import { proxyActivities } from "@temporalio/workflow";
import type { FixChatInput } from "../../shared";
import type * as activities from "./activities";

const {
  prepareChatSandbox,
  runChatTurn,
  finalizeChatTurn,
  teardownChatSandbox,
  failChat,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "45 minutes",
  retry: { maximumAttempts: 1 },
});

// One follow-up chat turn: reopen a sandbox on the run's existing fix branch, let
// the agent apply the user's request, push to the same branch so the PR updates
// in place, then tear down. runChatTurn / finalizeChatTurn never throw — only
// infra failures in sandbox prep surface here, and even then the run is returned
// to PR_OPENED rather than marked FAILED.
export async function fixChatWorkflow(input: FixChatInput): Promise<void> {
  try {
    const { sandboxId } = await prepareChatSandbox(input);
    try {
      const { committed } = await runChatTurn(input, sandboxId);
      await finalizeChatTurn(input, sandboxId, committed);
    } finally {
      await teardownChatSandbox(input, sandboxId);
    }
  } catch (err) {
    await failChat(input, err instanceof Error && err.message ? err.message : String(err));
    throw err;
  }
}
