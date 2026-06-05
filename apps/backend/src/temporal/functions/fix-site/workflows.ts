import { proxyActivities } from "@temporalio/workflow";
import type { FixSiteInput, FixSiteResult } from "../../shared";
import type * as activities from "./activities";

// prepareRun (scan + sandbox + clone) can be retried safely — it reconnects to
// the stored sandbox id. The harness and finalize are designed to never throw,
// so they don't need retries; we keep one attempt to avoid duplicate PRs.
const { prepareRun } = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 minutes",
  retry: { maximumAttempts: 3 },
});

const { runHarness, finalizeRun, teardownSandbox } = proxyActivities<typeof activities>({
  startToCloseTimeout: "45 minutes",
  retry: { maximumAttempts: 1 },
});

// The fix run is a harness: prepare the sandbox, let one autonomous agent fix
// the repo, then finalize (push + PR). The workflow never hard-fails on a fix
// problem — runHarness and finalizeRun return outcomes as data and the sandbox
// is always torn down. Only an infra failure in prepareRun (which is retried)
// can surface as a workflow error.
export async function fixSiteWorkflow(input: FixSiteInput): Promise<FixSiteResult> {
  const { sandboxId, tasks } = await prepareRun(input);

  try {
    const { committed, summary } = await runHarness(input, sandboxId, tasks);
    const result = await finalizeRun(input, sandboxId, committed, summary);
    return {
      prUrl: result.prUrl ?? "",
      prNumber: result.prNumber ?? 0,
      fixedChecks: result.fixedChecks,
      totalChecks: result.totalChecks,
    };
  } finally {
    await teardownSandbox(input, sandboxId);
  }
}
