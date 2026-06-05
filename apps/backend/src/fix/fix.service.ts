import { prisma } from "@repo/db";
import type {
  FixRunSummary,
  FixRunDetail,
  FixRunIntake,
} from "@repo/types/fix";

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
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
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
