import { prisma } from "@repo/db";
import type {
  FixRunState,
  SandboxStatus,
  FixCheckStatus,
} from "@repo/types/fix";
import { imageCostCents, sandboxCostCents, tokenCostCents } from "./cogs";

// DB helpers for a fix run: state transitions, per-check updates, and the
// append-only event log. Kept separate so the activities stay readable.

// Append a transcript event (and console.log it for now).
export async function logEvent(
  fixRunId: string,
  type: string,
  phase: string | null,
  payload?: Record<string, unknown>
): Promise<void> {
  const last = await prisma.runEvent.findFirst({
    where: { fixRunId },
    orderBy: { seq: "desc" },
    select: { seq: true },
  });
  const seq = (last?.seq ?? 0) + 1;

  console.log(
    `[fix-run ${fixRunId}] #${seq} ${type}${phase ? ` (${phase})` : ""}`,
  );
  // Round-trip through JSON so the value is a plain JSON-safe payload Prisma's
  // Json input accepts (drops undefined, functions, etc.).
  const safePayload =
    payload === undefined ? undefined : JSON.parse(JSON.stringify(payload));
  await prisma.runEvent.create({
    data: {
      fixRunId,
      seq,
      type,
      phase: phase ?? null,
      payload: safePayload,
    },
  });
}

export async function setState(fixRunId: string, state: FixRunState): Promise<void> {
  await prisma.fixRun.update({ where: { id: fixRunId }, data: { state } });
  await logEvent(fixRunId, "state_changed", state);
}

export async function setSandbox(
  fixRunId: string,
  sandboxId: string | null,
  sandboxStatus: SandboxStatus
): Promise<void> {
  await prisma.fixRun.update({
    where: { id: fixRunId },
    data: { sandboxId, sandboxStatus },
  });
}

export async function setError(fixRunId: string, error: string): Promise<void> {
  await prisma.fixRun.update({
    where: { id: fixRunId },
    data: { state: "FAILED", error },
  });
  await logEvent(fixRunId, "error", null, { error });
}

export async function setCheckStatus(
  fixRunId: string,
  rubricId: string,
  status: FixCheckStatus,
  opts: { fixed?: boolean; note?: string } = {}
): Promise<void> {
  await prisma.fixCheck.update({
    where: { fixRunId_rubricId: { fixRunId, rubricId } },
    data: { status, fixed: opts.fixed, note: opts.note },
  });
  await refreshCounters(fixRunId);
}

// Recompute denormalized counters on the run for cheap polling.
export async function refreshCounters(fixRunId: string): Promise<void> {
  const checks = await prisma.fixCheck.findMany({
    where: { fixRunId },
    select: { fixed: true, status: true },
  });
  const total = checks.length;
  const fixed = checks.filter((c) => c.fixed).length;
  const pending = checks.filter((c) => c.status === "PENDING" || c.status === "FIXING").length;
  await prisma.fixRun.update({
    where: { id: fixRunId },
    data: { totalChecks: total, fixedChecks: fixed, pendingChecks: pending },
  });
}

export async function setPr(
  fixRunId: string,
  branch: string,
  prUrl: string,
  prNumber: number
): Promise<void> {
  await prisma.fixRun.update({
    where: { id: fixRunId },
    data: { branch, prUrl, prNumber, state: "PR_OPENED" },
  });
  await logEvent(fixRunId, "pr_opened", null, { prUrl, prNumber });
}

export async function addCogs(
  fixRunId: string,
  tokensIn: number,
  tokensOut: number,
  model: string
): Promise<void> {
  const run = await prisma.fixRun.findUnique({
    where: { id: fixRunId },
    select: { tokensIn: true, tokensOut: true, imageCount: true },
  });
  const nextTokensIn = (run?.tokensIn ?? 0) + tokensIn;
  const nextTokensOut = (run?.tokensOut ?? 0) + tokensOut;
  const nextTokenCostCents = tokenCostCents(nextTokensIn, nextTokensOut);
  const nextImageCostCents = imageCostCents(run?.imageCount ?? 0);

  await prisma.fixRun.update({
    where: { id: fixRunId },
    data: {
      model,
      tokensIn: nextTokensIn,
      tokensOut: nextTokensOut,
      tokenCostCents: nextTokenCostCents,
      imageCostCents: nextImageCostCents,
    },
  });
  await logEvent(fixRunId, "token_usage_recorded", null, {
    model,
    tokensIn,
    tokensOut,
    totalTokensIn: nextTokensIn,
    totalTokensOut: nextTokensOut,
    tokenCostCents: nextTokenCostCents,
  });
}

export async function recordSandboxCogs(fixRunId: string): Promise<{
  sandboxSeconds: number;
  sandboxCostCents: number;
} | null> {
  const run = await prisma.fixRun.findUnique({
    where: { id: fixRunId },
    select: {
      createdAt: true,
      tokensIn: true,
      tokensOut: true,
      imageCount: true,
    },
  });
  if (!run) return null;

  const created = await prisma.runEvent.findFirst({
    where: { fixRunId, type: "sandbox_created" },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  const startedAt = created?.createdAt ?? run.createdAt;
  const sandboxSeconds = Math.max(
    0,
    Math.ceil((Date.now() - startedAt.getTime()) / 1000),
  );
  const nextSandboxCostCents = sandboxCostCents(sandboxSeconds);

  await prisma.fixRun.update({
    where: { id: fixRunId },
    data: {
      sandboxSeconds,
      tokenCostCents: tokenCostCents(run.tokensIn ?? 0, run.tokensOut ?? 0),
      sandboxCostCents: nextSandboxCostCents,
      imageCostCents: imageCostCents(run.imageCount),
    },
  });

  return { sandboxSeconds, sandboxCostCents: nextSandboxCostCents };
}
