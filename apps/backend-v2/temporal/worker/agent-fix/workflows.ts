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
  type FixGroup,
} from "./workflow-types";

const {
  fixSetupActivity,
  fixGroupActivity,
  fixRescanActivity,
  fixVerifyActivity,
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

// After a few automatic misses, pause and ask for explicit approval before the
// agent broadens scope. This is not a terminal cap: approval starts a fresh
// repair window, and declined blockers are recorded as skipped.
const AUTO_REPAIR_PASSES_BEFORE_DECISION = 3;

const submitFixDecisionsSignal = defineSignal<[AgentFixDecisionSignal]>(
  SUBMIT_FIX_DECISIONS_SIGNAL,
);

function needsDecision(group: FixGroup): boolean {
  return group.checks.some(
    (check) => check.mode === "NEEDS_INPUT" && check.choice !== "APPROVED",
  );
}

// Fix run: create sandbox + clone -> fix batches of related checks -> re-scan
// the served site to verify -> keep re-fixing whatever still fails -> ask the
// user to skip or approve larger retries whenever a blocker needs judgment or
// repeated automatic repair is not converging -> open PR only once the latest
// validation reaches 100/100, or all remaining score loss was skipped by user.
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
    // Even if no repair groups remain, PR creation must still pass the score
    // gate. This covers all-skipped runs and prevents build-only PR creation.
    if (groups.length === 0) {
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
      return;
    }

    let iteration = 0;
    let autoPassesSinceDecision = 0;
    while (true) {
      const decisionGroups = groups.filter(needsDecision);
      if (decisionGroups.length > 0) {
        await requestFixDecisionActivity({ input, groups: decisionGroups });
        await condition(() => pendingDecision !== null);

        const decision = pendingDecision;
        pendingDecision = null;
        const next = await collectFixDecisionActivity({
          input,
          decision: decision!,
        });
        groups = next.groups;
        autoPassesSinceDecision = 0;
        if (groups.length === 0) break;
        continue;
      }

      // Fix each batch (sequential — they edit the same repo). Each group is a
      // fresh model/tool invocation, so a model step limit never ends the run.
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
      iteration += 1;
      const rescan = await fixRescanActivity({
        input,
        sandboxId: setup.sandboxId,
        workdir: setup.workdir,
        iteration,
      });

      if (!rescan.ok) {
        if (rescan.nextGroups.length === 0) {
          throw new Error(
            `Validation scan could not complete (${rescan.reason ?? "unknown reason"}). PR was not opened.`,
          );
        }
        groups = rescan.nextGroups;
        autoPassesSinceDecision += 1;
        if (autoPassesSinceDecision >= AUTO_REPAIR_PASSES_BEFORE_DECISION) {
          await requestFixDecisionActivity({ input, groups });
          await condition(() => pendingDecision !== null);

          const decision = pendingDecision;
          pendingDecision = null;
          const next = await collectFixDecisionActivity({
            input,
            decision: decision!,
          });
          groups = next.groups;
          autoPassesSinceDecision = 0;
          if (groups.length === 0) break;
        }
        continue;
      }

      if (rescan.done) break;

      groups = rescan.nextGroups;
      if (groups.length === 0) {
        throw new Error(
          "Validation is still below 100/100, but no repairable blocker was produced. PR was not opened.",
        );
      }

      autoPassesSinceDecision += 1;
      if (
        rescan.needsDecision ||
        autoPassesSinceDecision >= AUTO_REPAIR_PASSES_BEFORE_DECISION
      ) {
        await requestFixDecisionActivity({ input, groups });
        await condition(() => pendingDecision !== null);

        const decision = pendingDecision;
        pendingDecision = null;
        const next = await collectFixDecisionActivity({
          input,
          decision: decision!,
        });
        groups = next.groups;
        autoPassesSinceDecision = 0;
        if (groups.length === 0) break;
      }
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
