import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import type {
  FixRunSummary,
  FixRunDetail,
  FixRunIntake,
  FixRunCogs,
} from "@repo/types/fix";
import { getTemporalClient } from "../temporal/client";
import { TASK_QUEUES } from "../temporal/shared";
import { submitFixIntakeSignal } from "../temporal/functions/fix-site/workflows";
import { fixChatWorkflow } from "../temporal/functions/fix-chat/workflows";
import { logEvent } from "../temporal/functions/fix-site/run-store";
import { CHAT_MESSAGE_LIMIT, EntitlementError } from "../billing/entitlements";

const exposeInternalCosts = process.env.NODE_ENV !== "production";

// Map a FixRun (+ repo) DB row to the summary view used by the polling endpoint.
function toSummary(run: {
  id: string;
  website: string;
  orderId: string | null;
  state: string;
  sandboxStatus: string;
  totalChecks: number;
  fixedChecks: number;
  pendingChecks: number;
  prUrl: string | null;
  error: string | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  sandboxSeconds: number | null;
  imageCount: number;
  tokenCostCents: number;
  sandboxCostCents: number;
  imageCostCents: number;
  createdAt: Date;
  updatedAt: Date;
  repository: { fullName: string };
}): FixRunSummary {
  return {
    id: run.id,
    website: run.website,
    repoFullName: run.repository.fullName,
    orderId: run.orderId,
    state: run.state as FixRunSummary["state"],
    sandboxStatus: run.sandboxStatus as FixRunSummary["sandboxStatus"],
    totalChecks: run.totalChecks,
    fixedChecks: run.fixedChecks,
    pendingChecks: run.pendingChecks,
    prUrl: run.prUrl,
    error: run.error,
    cogs: exposeInternalCosts ? toCogs(run) : null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

function toCogs(run: {
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  sandboxSeconds: number | null;
  imageCount: number;
  tokenCostCents: number;
  sandboxCostCents: number;
  imageCostCents: number;
}): FixRunCogs {
  const tokenCostCents = run.tokenCostCents ?? 0;
  const sandboxCostCents = run.sandboxCostCents ?? 0;
  const imageCostCents = run.imageCostCents ?? 0;

  return {
    model: run.model,
    tokensIn: run.tokensIn ?? 0,
    tokensOut: run.tokensOut ?? 0,
    sandboxSeconds: run.sandboxSeconds ?? 0,
    imageCount: run.imageCount,
    tokenCostCents,
    sandboxCostCents,
    imageCostCents,
    totalCostCents: tokenCostCents + sandboxCostCents + imageCostCents,
  };
}

function toIntake(value: unknown): FixRunIntake | null {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "version" in value &&
    "answers" in value
  ) {
    return value as FixRunIntake;
  }

  return null;
}

// All of a user's fix runs (active first). The centralized poll source.
export async function listUserRuns(userId: string): Promise<FixRunSummary[]> {
  const runs = await prisma.fixRun.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { repository: { select: { fullName: true } } },
  });
  return runs.map(toSummary);
}

// One run's full detail (checks + recent events).
export async function getRunDetail(
  userId: string,
  fixRunId: string,
): Promise<FixRunDetail | null> {
  const run = await prisma.fixRun.findFirst({
    where: { id: fixRunId, userId },
    include: {
      repository: { select: { fullName: true } },
      checks: { orderBy: { weight: "desc" } },
      events: { orderBy: { seq: "desc" }, take: 100 },
    },
  });
  if (!run) return null;

  return {
    ...toSummary(run),
    branch: run.branch,
    prNumber: run.prNumber,
    sandboxId: run.sandboxId,
    intake: toIntake(run.intake),
    checks: run.checks.map((c) => ({
      rubricId: c.rubricId,
      category: c.category,
      scope: c.scope,
      tier: c.tier,
      weight: c.weight,
      affectedCount: c.affectedCount,
      status: c.status as FixRunDetail["checks"][number]["status"],
      fixed: c.fixed,
      note: c.note,
    })),
    events: run.events
      .map((e) => ({
        seq: e.seq,
        type: e.type,
        phase: e.phase,
        payload: (e.payload as Record<string, unknown> | null) ?? null,
        createdAt: e.createdAt.toISOString(),
      }))
      .reverse(),
  };
}

export async function submitRunIntake(
  userId: string,
  fixRunId: string,
  intake: FixRunIntake,
): Promise<FixRunDetail | null> {
  const run = await prisma.fixRun.findFirst({
    where: { id: fixRunId, userId },
    select: { id: true, temporalWorkflowId: true, state: true },
  });
  if (!run) return null;

  // Clarifications are only meaningful while the run is paused at the gate. Once
  // the workflow has passed the waitpoint (FIXING onward) a late submit would
  // signal into the void, so reject it instead of silently no-op'ing.
  if (run.state !== "WAITING_FOR_INPUT") {
    throw new EntitlementError(
      409,
      "This fix run is no longer accepting clarification answers.",
    );
  }

  await prisma.fixRun.update({
    where: { id: run.id },
    data: { intake: intake as unknown as Prisma.InputJsonValue },
  });
  await logEvent(
    run.id,
    "intake_submitted",
    null,
    intake as unknown as Record<string, unknown>,
  );

  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(run.temporalWorkflowId);
  await handle.signal(submitFixIntakeSignal, intake);

  return getRunDetail(userId, fixRunId);
}

// Open-ended follow-up: the user messages the agent after the PR is open. We
// charge one message from the order's allowance, record it on the transcript,
// flip the run to CHATTING, and start a one-turn fix-chat workflow that edits the
// existing branch and pushes to the same PR. The order row is locked so two
// concurrent messages can't both slip past the cap.
export async function sendFixMessage(
  userId: string,
  fixRunId: string,
  content: string,
): Promise<FixRunDetail | null> {
  const run = await prisma.fixRun.findFirst({
    where: { id: fixRunId, userId },
    select: {
      id: true,
      state: true,
      branch: true,
      prUrl: true,
      prViaFork: true,
      website: true,
      repository: {
        select: { fullName: true, cloneUrl: true, defaultBranch: true },
      },
      order: { select: { id: true, status: true } },
    },
  });
  if (!run) return null;

  if (!run.prUrl || !run.branch) {
    throw new EntitlementError(
      409,
      "Chat opens once the agent has opened a PR for this run.",
    );
  }
  if (run.state === "CHATTING") {
    throw new EntitlementError(
      409,
      "The agent is still working on your previous message.",
    );
  }
  if (!run.order || run.order.status !== "PAID") {
    throw new EntitlementError(402, "This run's order is no longer active.");
  }
  const orderId = run.order.id;

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${orderId} FOR UPDATE`;

    // Authoritative busy check inside the lock: with the order row held, a second
    // concurrent message sees the first's CHATTING state and is rejected, so we
    // never run two chat turns on the same branch at once.
    const current = await tx.fixRun.findUnique({
      where: { id: run.id },
      select: { state: true },
    });
    if (current?.state === "CHATTING") {
      throw new EntitlementError(
        409,
        "The agent is still working on your previous message.",
      );
    }

    const locked = await tx.order.findUnique({
      where: { id: orderId },
      select: { chatMessagesUsed: true },
    });
    const used = locked?.chatMessagesUsed ?? 0;
    if (used >= CHAT_MESSAGE_LIMIT) {
      throw new EntitlementError(
        402,
        `You have used all ${CHAT_MESSAGE_LIMIT} chat messages included with this order.`,
      );
    }
    await tx.order.update({
      where: { id: orderId },
      data: { chatMessagesUsed: { increment: 1 } },
    });

    const last = await tx.runEvent.findFirst({
      where: { fixRunId: run.id },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    await tx.runEvent.create({
      data: {
        fixRunId: run.id,
        seq: (last?.seq ?? 0) + 1,
        type: "user_message",
        phase: "CHATTING",
        payload: { content },
      },
    });
    await tx.fixRun.update({
      where: { id: run.id },
      data: { state: "CHATTING" },
    });
  });

  try {
    const client = await getTemporalClient();
    const workflowId = `fixchat-${run.id.slice(0, 8)}-${Date.now()}`;
    await client.workflow.start(fixChatWorkflow, {
      taskQueue: TASK_QUEUES.fixChat,
      workflowId,
      args: [
        {
          fixRunId: run.id,
          userId,
          content,
          website: run.website,
          repoFullName: run.repository.fullName,
          cloneUrl: run.repository.cloneUrl,
          defaultBranch: run.repository.defaultBranch,
          branch: run.branch,
          prViaFork: run.prViaFork,
        },
      ],
      workflowExecutionTimeout: "1 hour",
    });
  } catch (err) {
    await prisma.fixRun.update({
      where: { id: run.id },
      data: { state: "PR_OPENED" },
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { chatMessagesUsed: { decrement: 1 } },
    });
    await logEvent(run.id, "chat_error", null, {
      error: err instanceof Error ? err.message : "Failed to start chat",
    });
    throw err;
  }

  return getRunDetail(userId, fixRunId);
}
