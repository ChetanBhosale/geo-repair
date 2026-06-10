import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";
import type { AgentFixWorkflowInput } from "./workflow-types";

const {
  fixSetupActivity,
  fixGroupActivity,
  fixRescanActivity,
  fixVerifyActivity,
  fixOpenPrActivity,
  fixTeardownActivity,
  failFixActivity,
  fixCompleteActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 minutes",
  retry: { maximumAttempts: 1 },
});

// Max fix<->rescan iterations. Research (Socratic-SWE) shows self-correcting
// coding agents plateau around three passes, so we cap there.
const MAX_ITERATIONS = 3;

// Fix run: create sandbox + clone -> fix batches of related checks -> re-scan
// the served site to verify -> re-fix whatever still fails (up to MAX_ITERATIONS)
// -> open PR -> tear down. The sandbox id is saved on the run so activities
// reconnect to the same microVM.
export async function agentFixWorkflow(input: AgentFixWorkflowInput): Promise<void> {
  let setup;
  try {
    setup = await fixSetupActivity(input);

    let groups = setup.groups;
    let verified = false;
    for (let iteration = 1; iteration <= MAX_ITERATIONS && groups.length > 0; iteration++) {
      // Fix each batch (sequential — they edit the same repo).
      for (const group of groups) {
        await fixGroupActivity({
          input,
          sandboxId: setup.sandboxId,
          workdir: setup.workdir,
          repoSummary: setup.repoSummary,
          group,
        });
      }

      // Verify by re-scanning the served site; outcomes are set from the result.
      const rescan = await fixRescanActivity({
        input,
        sandboxId: setup.sandboxId,
        workdir: setup.workdir,
        iteration,
      });

      if (!rescan.ok) {
        // Could not build/serve to verify — fall back to a build check + PR.
        await fixVerifyActivity({ input, sandboxId: setup.sandboxId, workdir: setup.workdir });
        verified = true;
        break;
      }
      verified = true;
      if (rescan.done) break;
      groups = rescan.nextGroups; // re-fix only what still fails
    }

    // No approved checks at all -> still do a build check before the PR.
    if (!verified) {
      await fixVerifyActivity({ input, sandboxId: setup.sandboxId, workdir: setup.workdir });
    }

    await fixOpenPrActivity({ input, sandboxId: setup.sandboxId, workdir: setup.workdir });
    await fixCompleteActivity(input);
  } catch (err) {
    await failFixActivity(input, err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    await fixTeardownActivity(input);
  }
}
