import { prisma } from "@repo/db";
import type { AgentPlanAnswer, StartFixResponse } from "@repo/types/agent";
import { getTemporalClient } from "../temporal/client";
import { TASK_QUEUES } from "../temporal/constants";
import type { AgentFixWorkflowInput } from "../temporal/worker/agent-fix/workflow-types";
import { markFixAttemptStarted } from "./billing.service";

export class FixError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FixError";
  }
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
    throw new FixError(502, `Could not queue the fix run: ${message}`);
  }

  const fixChecks = run.plan.checks.filter(
    (c) => c.mode === "AUTO" || byRubric.get(c.rubricId)?.choice === "APPROVED",
  ).length;

  return { agentRunId: run.id, status: "QUEUED", fixChecks };
}
