import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import type {
  FixRunSummary,
  FixRunDetail,
  FixRunIntake,
  FixRunCogs,
} from "@repo/types/fix";
import { getTemporalClient } from "../temporal/client";
import { submitFixIntakeSignal } from "../temporal/functions/fix-site/workflows";
import { logEvent } from "../temporal/functions/fix-site/run-store";

const exposeInternalCosts = process.env.NODE_ENV !== "production";

// Map a FixRun (+ repo) DB row to the summary view used by the polling endpoint.
function toSummary(run: {
  id: string;
  website: string;
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

  if (
    run.state === "PR_OPENED" ||
    run.state === "COMPLETED" ||
    run.state === "FAILED"
  ) {
    throw new Error("This fix run is no longer accepting clarification answers");
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
