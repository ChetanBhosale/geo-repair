import { WorkflowNotFoundError } from "@temporalio/client";
import { prisma } from "@repo/db";
import { getTemporalClient } from "./client";
import { TASK_QUEUES } from "./shared";
import type { ScrapeSiteResult, RequestMeta } from "./shared";
import { scrapeSiteWorkflow } from "./functions/scrape-site/workflows";

function auditWorkflowId(website: string): string {
  const host = (() => {
    try {
      return new URL(website).hostname;
    } catch {
      return "site";
    }
  })();
  return `audit-${host}-${Date.now()}`;
}

// How many times a given website has already been audited (0 if never).
export async function getScrapeCount(website: string): Promise<number> {
  const row = await prisma.scrapeGeo.findUnique({
    where: { website },
    select: { totalScrapeCount: true },
  });
  return row?.totalScrapeCount ?? 0;
}

// Starts a scrape-site audit and returns the workflowId to poll with.
// `website` must already be normalized to its origin root.
export async function startAudit(
  website: string,
  singlePage = false,
  meta?: RequestMeta
): Promise<string> {
  const client = await getTemporalClient();
  const workflowId = auditWorkflowId(website);

  await client.workflow.start(scrapeSiteWorkflow, {
    taskQueue: TASK_QUEUES.scrapeSite,
    workflowId,
    args: [{ url: website, singlePage, meta }],
    workflowExecutionTimeout: "15 minutes",
  });

  return workflowId;
}

export type AuditStatusResponse =
  | { status: "RUNNING" | "PENDING" }
  | { status: "COMPLETED"; result: ScrapeSiteResult }
  | { status: "FAILED" | "TERMINATED" | "CANCELED" | "TIMED_OUT"; error: string }
  | { status: "NOT_FOUND" };

// Returns the audit's status, and the result (key + summary) once completed.
export async function getAuditStatus(workflowId: string): Promise<AuditStatusResponse> {
  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(workflowId);

  try {
    const desc = await handle.describe();
    const status = desc.status.name;

    switch (status) {
      case "RUNNING":
        return { status: "RUNNING" };
      case "COMPLETED": {
        const result = (await handle.result()) as ScrapeSiteResult;
        return { status: "COMPLETED", result };
      }
      case "FAILED":
      case "TERMINATED":
      case "CANCELLED":
      case "TIMED_OUT":
        return {
          status: status === "CANCELLED" ? "CANCELED" : status,
          error: `Audit ${status.toLowerCase()}`,
        };
      default:
        return { status: "PENDING" };
    }
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) {
      return { status: "NOT_FOUND" };
    }
    throw err;
  }
}

// Loads a saved audit report from the DB by its key (ScrapeGeo.id).
export async function getAuditResult(key: string) {
  const row = await prisma.scrapeGeo.findUnique({ where: { id: key } });
  if (!row) return null;

  // websiteScrapeData is stored as a JSON-stringified report; parse it back to
  // an object so the API returns structured data, not an encoded string.
  let report: unknown = row.websiteScrapeData;
  if (typeof report === "string") {
    try {
      report = JSON.parse(report);
    } catch {
      // leave as-is if it somehow isn't valid JSON
    }
  }

  return {
    key: row.id,
    website: row.website,
    totalScrapeCount: row.totalScrapeCount,
    report,
  };
}
