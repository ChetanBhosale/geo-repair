import { WorkflowNotFoundError } from "@temporalio/client";
import { prisma } from "@repo/db";
import { getTemporalClient } from "./client";
import {
  appendCheckupRunEvent,
  createCheckupRun,
  getCheckupProgress,
  setCheckupProgress,
} from "./checkup-progress";
import { TASK_QUEUES } from "./shared";
import type { CheckupProgress, CheckupResult, RequestMeta } from "./shared";
import { checkupWorkflow } from "./functions/checkup/workflows";

function checkupWorkflowId(website: string): string {
  const host = (() => {
    try {
      return new URL(website).hostname;
    } catch {
      return "site";
    }
  })();
  return `checkup-${host}-${Date.now()}`;
}

// How many times a given website has already been checked (0 if never).
export async function getCheckupCount(website: string): Promise<number> {
  const row = await prisma.checkupReport.findUnique({
    where: { website },
    select: { totalCheckupCount: true },
  });
  return row?.totalCheckupCount ?? 0;
}

// Starts a checkup and returns the workflowId to poll with.
// `website` must already be normalized to its origin root.
export async function startCheckup(
  website: string,
  singlePage = false,
  meta?: RequestMeta
): Promise<string> {
  const client = await getTemporalClient();
  const workflowId = checkupWorkflowId(website);

  await createCheckupRun(workflowId, website);

  try {
    await client.workflow.start(checkupWorkflow, {
      taskQueue: TASK_QUEUES.checkup,
      workflowId,
      args: [{ workflowId, url: website, singlePage, meta }],
      workflowExecutionTimeout: "15 minutes",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setCheckupProgress(workflowId, {
      status: "failed",
      phase: "failed",
      error: message,
    });
    await appendCheckupRunEvent(workflowId, {
      phase: "failed",
      type: "failed",
      message,
    });
    throw err;
  }

  return workflowId;
}

export type CheckupStatusResponse =
  | { status: "RUNNING" | "PENDING"; progress: CheckupProgress | null }
  | {
      status: "COMPLETED";
      result: CheckupResult;
      progress: CheckupProgress | null;
    }
  | {
      status: "FAILED" | "TERMINATED" | "CANCELED" | "TIMED_OUT";
      error: string;
      progress: CheckupProgress | null;
    }
  | { status: "NOT_FOUND"; progress: null };

// Returns the checkup's status, progress, and result once completed.
export async function getCheckupStatus(
  workflowId: string
): Promise<CheckupStatusResponse> {
  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(workflowId);

  try {
    const desc = await handle.describe();
    const status = desc.status.name as string;

    switch (status) {
      case "RUNNING":
        return { status: "RUNNING", progress: await getCheckupProgress(workflowId) };
      case "COMPLETED": {
        const result = (await handle.result()) as CheckupResult;
        return {
          status: "COMPLETED",
          result,
          progress: await getCheckupProgress(workflowId),
        };
      }
      case "FAILED":
      case "TERMINATED":
      case "CANCELED":
      case "CANCELLED":
      case "TIMED_OUT": {
        const normalized = status === "CANCELLED" ? "CANCELED" : status;
        const error = `Checkup ${normalized.toLowerCase()}`;
        await setCheckupProgress(workflowId, {
          status:
            normalized === "TIMED_OUT"
              ? "timed_out"
              : normalized === "CANCELED"
                ? "canceled"
                : "failed",
          phase: "failed",
          error,
        });
        return {
          status: normalized as "FAILED" | "TERMINATED" | "CANCELED" | "TIMED_OUT",
          error,
          progress: await getCheckupProgress(workflowId),
        };
      }
      default:
        return { status: "PENDING", progress: await getCheckupProgress(workflowId) };
    }
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) {
      return { status: "NOT_FOUND", progress: null };
    }
    throw err;
  }
}

// Loads a saved checkup report from the DB by its key.
export async function getCheckupReport(key: string) {
  const row = await prisma.checkupReport.findUnique({ where: { id: key } });
  if (!row) return null;

  // reportData is stored as a JSON-stringified report; parse it back to an object
  // so the API returns structured data, not an encoded string.
  let report: unknown = row.reportData;
  if (typeof report === "string") {
    try {
      report = JSON.parse(report);
    } catch {
      // Leave as-is if it somehow is not valid JSON.
    }
  }

  return {
    key: row.id,
    website: row.website,
    websiteType: row.websiteType,
    totalCheckupCount: row.totalCheckupCount,
    report,
  };
}
