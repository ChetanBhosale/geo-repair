import {
  condition,
  defineSignal,
  proxyActivities,
  setHandler,
} from "@temporalio/workflow";
import type * as activities from "./activities";
import {
  SUBMIT_FIX_DECISIONS_SIGNAL,
  type AgentFixDecisionSignal,
  type AgentFixWorkflowInput,
  type RevalidateSetup,
} from "./workflow-types";

const {
  fixSetupActivity,
  fixGroupActivity,
  fixRescanActivity,
  fixVerifyActivity,
  revalidateSetupActivity,
  completeRevalidateActivity,
  failRevalidateActivity,
  revalidateTeardownActivity,
  requestFixDecisionActivity,
  collectFixDecisionActivity,
  assertPrReadyActivity,
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

const submitFixDecisionsSignal = defineSignal<[AgentFixDecisionSignal]>(
  SUBMIT_FIX_DECISIONS_SIGNAL,
);

// Fix run: create sandbox + clone -> fix batches of related checks -> re-scan
// the served site to verify -> re-fix whatever still fails (up to MAX_ITERATIONS)
// -> ask the user to skip or approve larger retries for anything still failing
// -> open PR only once every approved check is fixed or skipped -> tear down.
// The sandbox id is saved on the run so activities reconnect to the same microVM.
export async function agentFixWorkflow(
  input: AgentFixWorkflowInput,
): Promise<void> {
  let setup;
  let pendingDecision: AgentFixDecisionSignal | null = null;
  setHandler(submitFixDecisionsSignal, (decision) => {
    pendingDecision = decision;
  });

  try {
    setup = await fixSetupActivity(input);

    let groups = setup.groups;
    let verified = false;
    while (groups.length > 0) {
      for (
        let iteration = 1;
        iteration <= MAX_ITERATIONS && groups.length > 0;
        iteration++
      ) {
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
          // Could not serve/re-scan the site. Fall back to build-only
          // verification; that activity throws on failure, blocking PR creation.
          await fixVerifyActivity({
            input,
            sandboxId: setup.sandboxId,
            workdir: setup.workdir,
          });
          verified = true;
          break;
        }
        verified = true;
        groups = rescan.done ? [] : rescan.nextGroups;
      }

      if (groups.length === 0) break;

      await requestFixDecisionActivity({ input, groups });
      await condition(() => pendingDecision !== null);

      const decision = pendingDecision;
      pendingDecision = null;
      const next = await collectFixDecisionActivity({
        input,
        decision: decision!,
      });
      groups = next.groups;
    }

    // No approved checks at all -> still do a build check before the PR.
    if (!verified) {
      await fixVerifyActivity({
        input,
        sandboxId: setup.sandboxId,
        workdir: setup.workdir,
      });
    }

    await fixVerifyActivity({
      input,
      sandboxId: setup.sandboxId,
      workdir: setup.workdir,
    });
    await assertPrReadyActivity(input);
    await fixOpenPrActivity({
      input,
      sandboxId: setup.sandboxId,
      workdir: setup.workdir,
    });
    await fixCompleteActivity(input);
  } catch (err) {
    await failFixActivity(
      input,
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  } finally {
    await fixTeardownActivity(input);
  }
}

// User-triggered PR-branch verification. This does not consume chat messages and
// does not open or update the PR; it only refreshes build/check outcomes.
export async function agentRevalidateWorkflow(
  input: AgentFixWorkflowInput,
): Promise<void> {
  let setup: RevalidateSetup | undefined;

  try {
    setup = await revalidateSetupActivity(input);
    const rescan = await fixRescanActivity({
      input,
      sandboxId: setup.sandboxId,
      workdir: setup.workdir,
      iteration: 1,
    });

    if (!rescan.ok) {
      await fixVerifyActivity({
        input,
        sandboxId: setup.sandboxId,
        workdir: setup.workdir,
      });
    }

    await completeRevalidateActivity(input);
  } catch (err) {
    await failRevalidateActivity(
      input,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    if (setup) {
      await revalidateTeardownActivity({
        input,
        sandboxId: setup.sandboxId,
      });
    }
  }
}
