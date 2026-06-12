import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import type {
  ScanResult,
  ScrapingDetail,
  ScrapingSummary,
  WorkerStatusItem,
} from "@repo/types/scraping";
import { getTemporalClient } from "../temporal/client";
import { TASK_QUEUES } from "../temporal/constants";
// import { checkWorkerRunning } from "../lib/worker-health";
import type { ScrapeWorkflowInput } from "../temporal/worker/scraper/workflow-types";
import { projectBrandDataFromScan } from "../lib/brand-identity";
import { sendScrapingFinishedEmail } from "../lib/email-notifications";

export class ScrapingError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ScrapingError";
  }
}

function toSummary(row: {
  id: string;
  projectId: string;
  status: string;
  websiteUrl: string;
  score: number | null;
  scoreStatus: string | null;
  pagesChecked: number;
  error: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}): ScrapingSummary {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status as ScrapingSummary["status"],
    websiteUrl: row.websiteUrl,
    score: row.score,
    scoreStatus: row.scoreStatus,
    pagesChecked: row.pagesChecked,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

// Maps a scraper log entry to a Log row level.
// (logging happens inside the Temporal activity; see persist.ts)

// Start a scan: create the Scraping (RUNNING) + WorkerStatus, then enqueue the
// scrape on Temporal. The worker activity runs the scrape and writes logs +
// result back to these rows; the request returns immediately so the UI can
// poll. The offline `bun run scraper` CLI path does not go through here.
export async function startScan(
  userId: string,
  projectId: string,
): Promise<ScrapingSummary> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new ScrapingError(404, "Project not found.");

  // NOTE: worker-liveness gate disabled - describeTaskQueue check was not
  // behaving as expected. Re-enable once fixed.
  // if (!(await checkWorkerRunning(TASK_QUEUES.scraping))) {
  //   throw new ScrapingError(
  //     503,
  //     "The scan worker is offline right now. Please try again shortly.",
  //   );
  // }

  const scraping = await prisma.scraping.create({
    data: {
      projectId: project.id,
      userId,
      status: "RUNNING",
      websiteUrl: project.websiteUrl,
      startedAt: new Date(),
    },
  });

  const workflowId = `scrape-${scraping.id}`;

  await prisma.workerStatus.create({
    data: {
      service: "SCRAPING",
      status: "RUNNING",
      userId,
      projectId: project.id,
      scrapingId: scraping.id,
      temporalWorkflowId: workflowId,
      title: `Scan ${project.websiteUrl}`,
      startedAt: new Date(),
    },
  });

  try {
    const client = await getTemporalClient();
    const input: ScrapeWorkflowInput = {
      scrapingId: scraping.id,
      userId,
      projectId: project.id,
      url: project.websiteUrl,
    };
    await client.workflow.start("scrapeWorkflow", {
      taskQueue: TASK_QUEUES.scraping,
      workflowId,
      args: [input],
    });

    await prisma.scraping.update({
      where: { id: scraping.id },
      data: { temporalWorkflowId: workflowId },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.scraping.update({
      where: { id: scraping.id },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    await prisma.workerStatus.updateMany({
      where: { scrapingId: scraping.id },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    await prisma.log.create({
      data: {
        source: "SCRAPING",
        level: "ERROR",
        event: "enqueue_failed",
        message,
        scrapingId: scraping.id,
        projectId: project.id,
        userId,
      },
    });
    await sendScrapingFinishedEmail(scraping.id).catch((sendErr) => {
      console.error("[email] scan enqueue failure notification failed:", sendErr);
    });
    throw new ScrapingError(502, `Could not queue the scan: ${message}`);
  }

  return toSummary(scraping);
}

export async function getLatestScrapingForProject(
  userId: string,
  projectId: string,
): Promise<ScrapingDetail | null> {
  const row = await prisma.scraping.findFirst({
    where: { projectId, userId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  return getScrapingDetail(userId, row.id);
}

// All scans for a project, newest first (the run history list).
export async function listScrapingsForProject(
  userId: string,
  projectId: string,
): Promise<ScrapingSummary[]> {
  const rows = await prisma.scraping.findMany({
    where: { projectId, userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(toSummary);
}

// Active (QUEUED/RUNNING) worker rows for the live "what's running" panel.
// Scoped to the user; optionally narrowed to one project.
export async function listActiveWorkerStatus(
  userId: string,
  projectId?: string,
): Promise<WorkerStatusItem[]> {
  const rows = await prisma.workerStatus.findMany({
    where: {
      userId,
      status: { in: ["QUEUED", "RUNNING"] },
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(toWorkerItem);
}

function toWorkerItem(row: {
  id: string;
  service: string;
  status: string;
  title: string | null;
  progress: number | null;
  error: string | null;
  projectId: string | null;
  scrapingId: string | null;
  temporalWorkflowId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}): WorkerStatusItem {
  return {
    id: row.id,
    service: row.service as WorkerStatusItem["service"],
    status: row.status as WorkerStatusItem["status"],
    title: row.title,
    progress: row.progress,
    error: row.error,
    projectId: row.projectId,
    scrapingId: row.scrapingId,
    temporalWorkflowId: row.temporalWorkflowId,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

// Reconcile a run against Temporal. Used when the DB still says RUNNING/QUEUED
// but the worker may have finished (or died) without writing back. Reads the
// workflow state by its id and syncs the Scraping + WorkerStatus rows.
export async function reconcileScraping(
  userId: string,
  scrapingId: string,
): Promise<ScrapingDetail | null> {
  const row = await prisma.scraping.findFirst({
    where: { id: scrapingId, userId },
  });
  if (!row) return null;
  await syncScrapingFromTemporal(row);
  return getScrapingDetail(userId, scrapingId);
}

// API 2: given a temporalWorkflowId, check Temporal, update the WorkerStatus +
// Scraping rows, and return the refreshed worker item. The frontend calls this
// for each active worker id it got from the list.
export async function reconcileWorkerByWorkflowId(
  userId: string,
  workflowId: string,
): Promise<WorkerStatusItem | null> {
  const worker = await prisma.workerStatus.findFirst({
    where: { temporalWorkflowId: workflowId, userId },
  });
  if (!worker) return null;

  if (worker.scrapingId) {
    const scraping = await prisma.scraping.findFirst({
      where: { id: worker.scrapingId, userId },
    });
    if (scraping) await syncScrapingFromTemporal(scraping);
  }

  const fresh = await prisma.workerStatus.findUnique({
    where: { id: worker.id },
  });
  return fresh ? toWorkerItem(fresh) : null;
}

// Shared core: reads the workflow by id and writes terminal state to the
// Scraping + WorkerStatus rows. No-op when the row is already terminal, has no
// workflow id, or Temporal is unreachable.
async function syncScrapingFromTemporal(row: {
  id: string;
  projectId: string;
  status: string;
  temporalWorkflowId: string | null;
}): Promise<void> {
  const stillOpen = row.status === "RUNNING" || row.status === "QUEUED";
  if (!stillOpen || !row.temporalWorkflowId) return;

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(row.temporalWorkflowId);
    const desc = await handle.describe();

    if (desc.status.name === "COMPLETED") {
      const result = (await handle.result()) as ScanResult;
      await prisma.scraping.update({
        where: { id: row.id },
        data: {
          status: result.status === "completed" ? "COMPLETED" : "FAILED",
          result: result as unknown as Prisma.InputJsonValue,
          score: result.score.overall,
          scoreStatus: result.score.status,
          pagesChecked: result.crawl.pagesChecked,
          pagesFailed: result.crawl.pagesFailed,
          error: result.error,
          finishedAt: new Date(),
        },
      });
      await prisma.workerStatus.updateMany({
        where: { scrapingId: row.id },
        data: {
          status: result.status === "completed" ? "COMPLETED" : "FAILED",
          error: result.error,
          finishedAt: new Date(),
        },
      });
      const brandData = projectBrandDataFromScan(result);
      if (result.status === "completed" && brandData) {
        await prisma.project.update({
          where: { id: row.projectId },
          data: brandData,
        });
      }
      await sendScrapingFinishedEmail(row.id).catch((sendErr) => {
        console.error("[email] scan reconcile notification failed:", sendErr);
      });
    } else if (
      desc.status.name === "FAILED" ||
      desc.status.name === "TERMINATED" ||
      desc.status.name === "TIMED_OUT" ||
      desc.status.name === "CANCELLED"
    ) {
      const canceled = desc.status.name === "CANCELLED";
      const message = `Workflow ${desc.status.name.toLowerCase()}.`;
      await prisma.scraping.update({
        where: { id: row.id },
        data: {
          status: canceled ? "CANCELED" : "FAILED",
          error: message,
          finishedAt: new Date(),
        },
      });
      await prisma.workerStatus.updateMany({
        where: { scrapingId: row.id },
        data: {
          status: canceled ? "CANCELED" : "FAILED",
          error: message,
          finishedAt: new Date(),
        },
      });
      await prisma.log.create({
        data: {
          source: "SCRAPING",
          level: "ERROR",
          event: "workflow_reconcile_failed",
          message,
          scrapingId: row.id,
        },
      });
      await sendScrapingFinishedEmail(row.id).catch((sendErr) => {
        console.error("[email] scan reconcile failure notification failed:", sendErr);
      });
    }
    // RUNNING -> leave as-is.
  } catch {
    // Temporal unreachable: leave the DB as-is.
  }
}

export async function getScrapingDetail(
  userId: string,
  scrapingId: string,
): Promise<ScrapingDetail | null> {
  const row = await prisma.scraping.findFirst({
    where: { id: scrapingId, userId },
    include: { logs: { orderBy: { seq: "asc" }, take: 500 } },
  });
  if (!row) return null;

  return {
    ...toSummary(row),
    result: (row.result as ScrapingDetail["result"]) ?? null,
    logs: row.logs.map((l) => ({
      seq: l.seq,
      level: l.level.toLowerCase() as "info" | "warn" | "error",
      event: l.event,
      message: l.message ?? "",
      createdAt: l.createdAt.toISOString(),
    })),
  };
}
