import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import type {
  CheckupPhase,
  CheckupProgress,
  CheckupProgressEvent,
  CheckupRunStatus,
  RecentCheckupPage,
} from "./shared";

type ProgressPatch = Partial<{
  status: CheckupRunStatus;
  phase: CheckupPhase;
  pagesTotal: number;
  pagesCompleted: number;
  pagesFailed: number;
  checksEvaluated: number;
  issuesFound: number;
  currentPageUrl: string | null;
  resultKey: string | null;
  error: string | null;
}>;

type ProgressIncrement = Partial<{
  pagesCompleted: number;
  pagesFailed: number;
  checksEvaluated: number;
  issuesFound: number;
}>;

type CheckupRunEventInput = {
  phase: CheckupPhase;
  type: string;
  message: string;
  pageUrl?: string | null;
  metadata?: unknown;
};

function progressPercent(progress: {
  status: string;
  phase: string;
  pagesTotal: number;
  pagesCompleted: number;
  pagesFailed: number;
}): number {
  if (progress.status === "completed" || progress.phase === "completed")
    return 100;
  if (progress.status === "failed" || progress.phase === "failed") return 100;

  if (progress.phase === "scoring_pages" && progress.pagesTotal > 0) {
    const done = Math.min(
      progress.pagesTotal,
      progress.pagesCompleted + progress.pagesFailed,
    );
    return Math.min(89, 45 + Math.round((done / progress.pagesTotal) * 40));
  }

  switch (progress.phase) {
    case "queued":
      return 5;
    case "fetching_homepage":
      return 12;
    case "reading_crawl_files":
      return 24;
    case "discovering_pages":
      return 36;
    case "scoring_pages":
      return 45;
    case "aggregating_report":
      return 90;
    case "saving_report":
      return 96;
    default:
      return 5;
  }
}

function recentPages(events: CheckupProgressEvent[]): RecentCheckupPage[] {
  return events
    .filter(
      (event) =>
        event.type === "page_completed" || event.type === "page_failed",
    )
    .slice(-5)
    .reverse()
    .map((event) => {
      const metadata =
        typeof event.metadata === "object" && event.metadata !== null
          ? (event.metadata as Record<string, unknown>)
          : {};
      const score =
        typeof metadata.score === "number" ? metadata.score : undefined;
      const status: RecentCheckupPage["status"] =
        event.type === "page_completed" ? "completed" : "failed";
      return {
        url: event.pageUrl ?? "",
        status,
        ...(score === undefined ? {} : { score }),
      };
    })
    .filter((page) => page.url.length > 0);
}

function toProgress(
  run: {
    workflowId: string;
    website: string;
    status: string;
    phase: string;
    pagesTotal: number;
    pagesCompleted: number;
    pagesFailed: number;
    checksEvaluated: number;
    issuesFound: number;
    currentPageUrl: string | null;
    resultKey: string | null;
    error: string | null;
    updatedAt: Date;
  },
  events: CheckupProgressEvent[],
): CheckupProgress {
  const status = run.status as CheckupRunStatus;
  const phase = run.phase as CheckupPhase;

  return {
    workflowId: run.workflowId,
    website: run.website,
    status,
    phase,
    percent: progressPercent({ ...run, status, phase }),
    pagesTotal: run.pagesTotal,
    pagesCompleted: run.pagesCompleted,
    pagesFailed: run.pagesFailed,
    checksEvaluated: run.checksEvaluated,
    issuesFound: run.issuesFound,
    currentPageUrl: run.currentPageUrl,
    recentPages: recentPages(events),
    events,
    resultKey: run.resultKey,
    error: run.error,
    updatedAt: run.updatedAt.toISOString(),
  };
}

export async function createCheckupRun(
  workflowId: string,
  website: string,
): Promise<void> {
  await prisma.checkupRun.create({
    data: {
      workflowId,
      website,
      status: "queued",
      phase: "queued",
      events: {
        create: {
          sequence: 1,
          phase: "queued",
          type: "queued",
          message: "Checkup queued.",
        },
      },
    },
  });
}

export async function setCheckupProgress(
  workflowId: string,
  patch: ProgressPatch,
  increment?: ProgressIncrement,
): Promise<void> {
  const data: Prisma.CheckupRunUncheckedUpdateInput = {};

  if (patch.status !== undefined) data.status = patch.status;
  if (patch.phase !== undefined) data.phase = patch.phase;
  if (patch.pagesTotal !== undefined) data.pagesTotal = patch.pagesTotal;
  if (patch.pagesCompleted !== undefined)
    data.pagesCompleted = patch.pagesCompleted;
  if (patch.pagesFailed !== undefined) data.pagesFailed = patch.pagesFailed;
  if (patch.checksEvaluated !== undefined)
    data.checksEvaluated = patch.checksEvaluated;
  if (patch.issuesFound !== undefined) data.issuesFound = patch.issuesFound;
  if (patch.currentPageUrl !== undefined)
    data.currentPageUrl = patch.currentPageUrl;
  if (patch.resultKey !== undefined) data.resultKey = patch.resultKey;
  if (patch.error !== undefined) data.error = patch.error;

  if (increment?.pagesCompleted !== undefined) {
    data.pagesCompleted = { increment: increment.pagesCompleted };
  }
  if (increment?.pagesFailed !== undefined) {
    data.pagesFailed = { increment: increment.pagesFailed };
  }
  if (increment?.checksEvaluated !== undefined) {
    data.checksEvaluated = { increment: increment.checksEvaluated };
  }
  if (increment?.issuesFound !== undefined) {
    data.issuesFound = { increment: increment.issuesFound };
  }

  if (Object.keys(data).length === 0) return;

  await prisma.checkupRun.update({
    where: { workflowId },
    data,
  });
}

export async function appendCheckupRunEvent(
  workflowId: string,
  event: CheckupRunEventInput,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "checkupRuns" WHERE "workflowId" = ${workflowId} FOR UPDATE
    `;
    const run = lockedRows[0];
    if (!run) return;

    const lastEvent = await tx.checkupRunEvent.findFirst({
      where: { runId: run.id },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });

    await tx.checkupRunEvent.create({
      data: {
        runId: run.id,
        sequence: (lastEvent?.sequence ?? 0) + 1,
        phase: event.phase,
        type: event.type,
        message: event.message,
        pageUrl: event.pageUrl ?? null,
        metadata:
          event.metadata === undefined
            ? undefined
            : (event.metadata as Prisma.InputJsonValue),
      },
    });
  });
}

export async function getCheckupProgress(
  workflowId: string,
): Promise<CheckupProgress | null> {
  const run = await prisma.checkupRun.findUnique({
    where: { workflowId },
    include: {
      events: {
        orderBy: [{ sequence: "desc" }, { createdAt: "desc" }],
        take: 50,
      },
    },
  });
  if (!run) return null;

  const events: CheckupProgressEvent[] = [...run.events]
    .reverse()
    .map((event) => ({
      sequence: event.sequence,
      phase: event.phase as CheckupPhase,
      type: event.type,
      message: event.message,
      pageUrl: event.pageUrl,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
    }));

  return toProgress(run, events);
}
