import {
  condition,
  defineSignal,
  proxyActivities,
  setHandler,
} from "@temporalio/workflow";
import type { FixRunIntake } from "@repo/types/fix";
import type { FixSiteInput, FixSiteResult } from "../../shared";
import type * as activities from "./activities";

export const submitFixIntakeSignal =
  defineSignal<[FixRunIntake]>("submitFixIntake");

// planRun can be retried safely before a sandbox exists. prepareSandbox can be
// retried safely because it reconnects to the stored sandbox id. The harness
// and finalize are designed to never throw, so they don't need retries; we keep
// one attempt to avoid duplicate PRs.
const { planRun, prepareSandbox } = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 minutes",
  retry: { maximumAttempts: 3 },
});

const {
  runPlanningAgent,
  runHarness,
  finalizeRun,
  teardownSandbox,
  failRun,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "45 minutes",
  retry: { maximumAttempts: 1 },
});

// The fix run is a harness: prepare the sandbox, let one autonomous agent fix
// the repo, then finalize (push + PR). The workflow never hard-fails on a fix
// problem — runHarness and finalizeRun return outcomes as data and the sandbox
// is always torn down. Only infra failures in planning or sandbox setup can
// surface as workflow errors.
export async function fixSiteWorkflow(input: FixSiteInput): Promise<FixSiteResult> {
  let intake = input.intake;
  setHandler(submitFixIntakeSignal, (submitted) => {
    intake = submitted;
  });

  try {
    const { tasks, reportContext } = await planRun(input);
    let shouldWaitForIntake = false;

    if (!intake?.answers.length && tasks.length) {
      const planningSandbox = await prepareSandbox(input);
      try {
        const clarificationRequest = await runPlanningAgent(
          input,
          planningSandbox.sandboxId,
          tasks,
          reportContext,
        );
        shouldWaitForIntake = !!clarificationRequest?.questions.length;
      } finally {
        await teardownSandbox(input, planningSandbox.sandboxId);
      }
    }

    if (!intake?.answers.length && shouldWaitForIntake) {
      await condition(() => !!intake?.answers.length);
    }

    const runInput: FixSiteInput = intake ? { ...input, intake } : input;
    const { sandboxId } = await prepareSandbox(runInput);

    try {
      const { committed, summary } = await runHarness(runInput, sandboxId, tasks);
      const result = await finalizeRun(runInput, sandboxId, committed, summary);
      return {
        prUrl: result.prUrl ?? "",
        prNumber: result.prNumber ?? 0,
        fixedChecks: result.fixedChecks,
        totalChecks: result.totalChecks,
      };
    } finally {
      await teardownSandbox(runInput, sandboxId);
    }
  } catch (err) {
    await failRun(input, workflowErrorMessage(err));
    throw err;
  }
}

function workflowErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}
