import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";
import type { AgentFixWorkflowInput } from "./workflow-types";

const {
  fixSetupActivity,
  fixCheckActivity,
  fixVerifyActivity,
  fixOpenPrActivity,
  fixTeardownActivity,
  failFixActivity,
  fixCompleteActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "20 minutes",
  retry: { maximumAttempts: 1 },
});

// Fix run: create sandbox + clone -> fix each approved check (one activity each)
// -> verify build -> open PR -> tear down. The sandbox id is saved on the run so
// activities reconnect to the same microVM.
export async function agentFixWorkflow(input: AgentFixWorkflowInput): Promise<void> {
  let setup;
  try {
    setup = await fixSetupActivity(input);

    // Each check is its own activity (sequential — they edit the same repo).
    for (const check of setup.checks) {
      await fixCheckActivity({
        input,
        sandboxId: setup.sandboxId,
        workdir: setup.workdir,
        check,
      });
    }

    await fixVerifyActivity({ input, sandboxId: setup.sandboxId, workdir: setup.workdir });
    await fixOpenPrActivity({ input, sandboxId: setup.sandboxId, workdir: setup.workdir });
    await fixCompleteActivity(input);
  } catch (err) {
    await failFixActivity(input, err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    await fixTeardownActivity(input);
  }
}
