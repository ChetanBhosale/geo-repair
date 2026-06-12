import { prisma } from "@repo/db";
import type {
  AgentPlanAnswer,
  RevalidateRunResponse,
  StartFixResponse,
} from "@repo/types/agent";
import { getTemporalClient } from "../temporal/client";
import { TASK_QUEUES } from "../temporal/constants";
import {
  SUBMIT_FIX_DECISIONS_SIGNAL,
  type AgentFixWorkflowInput,
} from "../temporal/worker/agent-fix/workflow-types";
import { markFixAttemptStarted } from "./billing.service";
import { sendFixFailedEmail } from "../lib/email-notifications";
import { getPrStatus } from "../lib/github";
import { MANUAL_REVALIDATION_LIMIT } from "@repo/types/entitlements";

export class FixError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FixError";
  }
}

interface FixRunDecisionContext {
  id: string;
  projectId: string;
  userId: string;
  temporalWorkflowId: string | null;
  plan: {
    id: string;
    checks: {
      rubricId: string;
      mode: string;
      choice: string;
    }[];
  } | null;
}

// Submit the user's plan answers and start the fix run. Guards against a double
// submit: the run must be AWAITING_INPUT, otherwise it's already submitted or
// running and we reject.
export async function startFix(
  userId: string,
  agentRunId: string,
  answers: AgentPlanAnswer[],
): Promise<StartFixResponse> {
  const run = await prisma.agentRun.findFirst({
    where: { id: agentRunId, userId },
    include: { order: true, plan: { include: { checks: true } } },
  });
  if (!run) throw new FixError(404, "Agent run not found.");
  if (!run.plan) throw new FixError(400, "This run has no plan yet.");
  if (!run.order || run.order.status !== "PAID") {
    throw new FixError(402, "A paid AI Search Fix order is required.");
  }
  if (run.status !== "AWAITING_INPUT") {
    throw new FixError(409, "This plan was already submitted.");
  }
  if (run.plan.status === "SUBMITTED") {
    return submitFixDecisions(userId, run, answers);
  }

  // Persist the user's answers onto the matching checks.
  const byRubric = new Map(answers.map((a) => [a.rubricId, a]));
  const needsInput = run.plan.checks.filter((c) => c.mode === "NEEDS_INPUT");
  for (const c of needsInput) {
    const a = byRubric.get(c.rubricId);
    if (!a) throw new FixError(400, `Missing an answer for "${c.rubricId}".`);
    if (a.choice !== "APPROVED" && a.choice !== "DECLINED") {
      throw new FixError(
        400,
        `Answer for "${c.rubricId}" must be approved or declined.`,
      );
    }
    await prisma.agentPlanCheck.update({
      where: { id: c.id },
      data: {
        choice: a.choice,
        selectedOption: a.selectedOption ?? null,
        userSuggestion: a.userSuggestion ?? null,
      },
    });
  }

  await prisma.agentPlan.update({
    where: { id: run.plan.id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  await prisma.agentRun.update({
    where: { id: run.id },
    data: { status: "QUEUED", error: null },
  });

  const workflowId = `agent-fix-${run.id}`;
  await prisma.workerStatus.create({
    data: {
      service: "AGENT",
      status: "RUNNING",
      userId,
      projectId: run.projectId,
      temporalWorkflowId: workflowId,
      title: `Fix run ${run.id}`,
      startedAt: new Date(),
    },
  });

  try {
    const client = await getTemporalClient();
    const input: AgentFixWorkflowInput = {
      agentRunId: run.id,
      agentPlanId: run.plan.id,
      projectId: run.projectId,
      userId,
    };
    await client.workflow.start("agentFixWorkflow", {
      taskQueue: TASK_QUEUES.agentFix,
      workflowId,
      args: [input],
    });
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { temporalWorkflowId: workflowId },
    });
    await markFixAttemptStarted(run.order.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    await prisma.workerStatus.updateMany({
      where: { temporalWorkflowId: workflowId },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    await sendFixFailedEmail(run.id, message).catch((sendErr) => {
      console.error("[email] fix enqueue failure notification failed:", sendErr);
    });
    throw new FixError(502, `Could not queue the fix run: ${message}`);
  }

  const fixChecks = run.plan.checks.filter(
    (c) => c.mode === "AUTO" || byRubric.get(c.rubricId)?.choice === "APPROVED",
  ).length;

  return { agentRunId: run.id, status: "QUEUED", fixChecks };
}

export async function startRevalidate(
  userId: string,
  agentRunId: string,
): Promise<RevalidateRunResponse> {
  const run = await prisma.agentRun.findFirst({
    where: { id: agentRunId, userId },
    include: {
      order: true,
      plan: true,
      project: { include: { account: { select: { accessToken: true } } } },
    },
  });
  if (!run) throw new FixError(404, "Agent run not found.");
  if (!run.plan) throw new FixError(400, "This run has no plan yet.");
  if (!run.order || run.order.status !== "PAID") {
    throw new FixError(402, "A paid AI Search Fix order is required.");
  }
  if (!run.prUrl || !run.prNumber || !run.branch) {
    throw new FixError(409, "Revalidation is available once the PR is open.");
  }
  if (run.status !== "PR_OPENED") {
    throw new FixError(409, "Wait for the current agent task to finish first.");
  }
  if (run.order.manualRevalidationsUsed >= MANUAL_REVALIDATION_LIMIT) {
    throw new FixError(
      409,
      "This order has used all manual revalidations.",
    );
  }

  if (run.project) {
    const pr = await getPrStatus(
      run.project.owner,
      run.project.name,
      run.prNumber,
      run.project.account?.accessToken,
    );
    if (pr?.merged || run.prMerged) {
      await prisma.agentRun.update({
        where: { id: run.id },
        data: { prMerged: true, prState: "MERGED", prMergedAt: new Date() },
      });
      throw new FixError(409, "The PR has been merged. This run is complete.");
    }
  }

  await prisma.$transaction(async (tx) => {
    const updatedRun = await tx.agentRun.updateMany({
      where: { id: run.id, status: "PR_OPENED" },
      data: { status: "VERIFYING", error: null },
    });
    if (updatedRun.count === 0) {
      throw new FixError(409, "Wait for the current agent task to finish first.");
    }

    const updatedOrder = await tx.order.updateMany({
      where: {
        id: run.order!.id,
        status: "PAID",
        manualRevalidationsUsed: { lt: MANUAL_REVALIDATION_LIMIT },
      },
      data: { manualRevalidationsUsed: { increment: 1 } },
    });
    if (updatedOrder.count === 0) {
      throw new FixError(
        409,
        "This order has used all manual revalidations.",
      );
    }
  });

  const workflowId = `agent-revalidate-${run.id}-${Date.now()}`;
  try {
    const client = await getTemporalClient();
    const input: AgentFixWorkflowInput = {
      agentRunId: run.id,
      agentPlanId: run.plan.id,
      projectId: run.projectId,
      userId,
    };
    await client.workflow.start("agentRevalidateWorkflow", {
      taskQueue: TASK_QUEUES.agentFix,
      workflowId,
      args: [input],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "PR_OPENED", error: message },
    });
    await prisma.order
      .update({
        where: { id: run.order.id },
        data: { manualRevalidationsUsed: { decrement: 1 } },
      })
      .catch(() => {});
    throw new FixError(502, `Could not queue revalidation: ${message}`);
  }

  return { agentRunId: run.id, status: "VERIFYING" };
}

async function submitFixDecisions(
  userId: string,
  run: FixRunDecisionContext,
  answers: AgentPlanAnswer[],
): Promise<StartFixResponse> {
  if (!run?.plan) throw new FixError(400, "This run has no plan yet.");

  const pending = run.plan.checks.filter(
    (check) => check.mode === "NEEDS_INPUT" && check.choice === "PENDING",
  );
  if (pending.length === 0) {
    throw new FixError(400, "There are no pending decisions for this run.");
  }

  const byRubric = new Map(answers.map((answer) => [answer.rubricId, answer]));
  for (const check of pending) {
    const answer = byRubric.get(check.rubricId);
    if (!answer) {
      throw new FixError(400, `Missing an answer for "${check.rubricId}".`);
    }
    if (answer.choice !== "APPROVED" && answer.choice !== "DECLINED") {
      throw new FixError(
        400,
        `Answer for "${check.rubricId}" must be approved or declined.`,
      );
    }
  }

  const workflowId = run.temporalWorkflowId ?? `agent-fix-${run.id}`;
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    await handle.signal(SUBMIT_FIX_DECISIONS_SIGNAL, {
      answers,
      submittedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new FixError(502, `Could not resume the fix run: ${message}`);
  }

  await prisma.agentRun.update({
    where: { id: run.id },
    data: { status: "QUEUED", error: null },
  });
  await prisma.log.create({
    data: {
      source: "USER",
      level: "INFO",
      event: "fix_decision_submitted",
      message: `Submitted decisions for ${pending.length} unresolved check(s).`,
      agentRunId: run.id,
      agentPlanId: run.plan.id,
      projectId: run.projectId,
      userId,
    },
  });

  return { agentRunId: run.id, status: "QUEUED", fixChecks: pending.length };
}
