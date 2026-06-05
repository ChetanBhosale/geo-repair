import { prisma } from "@repo/db";
import {
  appendCheckupRunEvent,
  setCheckupProgress,
} from "../../checkup-progress";
import type { CheckupInput, CheckupResult } from "../../shared";
import { checkSite, type CheckupProgressSignal } from "./crawler";

async function recordProgress(
  workflowId: string,
  signal: CheckupProgressSignal,
): Promise<void> {
  switch (signal.type) {
    case "phase":
      await setCheckupProgress(workflowId, {
        status: signal.phase === "completed" ? "completed" : "running",
        phase: signal.phase,
        ...(signal.phase === "scoring_pages" ? {} : { currentPageUrl: null }),
      });
      await appendCheckupRunEvent(workflowId, {
        phase: signal.phase,
        type: signal.type,
        message: signal.message,
        metadata: signal.metadata,
      });
      break;
    case "pages_discovered":
      await setCheckupProgress(workflowId, {
        status: "running",
        phase: signal.phase,
        pagesTotal: signal.pagesTotal,
      });
      await appendCheckupRunEvent(workflowId, {
        phase: signal.phase,
        type: signal.type,
        message: signal.message,
        metadata: signal.metadata,
      });
      break;
    case "page_started":
      await setCheckupProgress(workflowId, {
        status: "running",
        phase: signal.phase,
        currentPageUrl: signal.pageUrl,
      });
      await appendCheckupRunEvent(workflowId, {
        phase: signal.phase,
        type: signal.type,
        message: signal.message,
        pageUrl: signal.pageUrl,
      });
      break;
    case "page_completed":
      await setCheckupProgress(
        workflowId,
        {
          status: "running",
          phase: signal.phase,
          currentPageUrl: null,
        },
        {
          pagesCompleted: 1,
          checksEvaluated: signal.checksEvaluated,
          issuesFound: signal.issuesFound,
        },
      );
      await appendCheckupRunEvent(workflowId, {
        phase: signal.phase,
        type: signal.type,
        message: signal.message,
        pageUrl: signal.pageUrl,
        metadata: {
          score: signal.score,
          checksEvaluated: signal.checksEvaluated,
          issuesFound: signal.issuesFound,
        },
      });
      break;
    case "page_failed":
      await setCheckupProgress(
        workflowId,
        {
          status: "running",
          phase: signal.phase,
          currentPageUrl: null,
        },
        { pagesFailed: 1 },
      );
      await appendCheckupRunEvent(workflowId, {
        phase: signal.phase,
        type: signal.type,
        message: signal.message,
        pageUrl: signal.pageUrl,
      });
      break;
  }
}

// Activity for the checkup queue. Does the network I/O (fetch + scoring), so it
// lives here and never in the workflow. The full report is saved to the DB and
// only a small key + summary is returned, keeping the Temporal payload under
// the 2 MB limit. singlePage caps the crawl to the homepage.
export async function runCheckup(input: CheckupInput): Promise<CheckupResult> {
  try {
    const report = await checkSite(input.url, {
      ...(input.singlePage ? { maxPages: 1 } : {}),
      progress: (signal) => recordProgress(input.workflowId, signal),
    });
    const data = JSON.stringify(report);
    const meta = input.meta ?? {};
    const websiteType = report.siteInfo.websiteType;

    await recordProgress(input.workflowId, {
      type: "phase",
      phase: "saving_report",
      message: "Saving checkup report.",
    });

    const row = await prisma.checkupReport.upsert({
      where: { website: input.url },
      create: {
        website: input.url,
        websiteType,
        reportData: data,
        totalCheckupCount: 1,
        singlePage: Boolean(input.singlePage),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        referer: meta.referer ?? null,
        origin: meta.origin ?? null,
      },
      update: {
        websiteType,
        reportData: data,
        totalCheckupCount: { increment: 1 },
        singlePage: Boolean(input.singlePage),
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        referer: meta.referer ?? null,
        origin: meta.origin ?? null,
      },
    });

    await setCheckupProgress(input.workflowId, {
      status: "completed",
      phase: "completed",
      currentPageUrl: null,
      resultKey: row.id,
      error: null,
    });
    await appendCheckupRunEvent(input.workflowId, {
      phase: "completed",
      type: "completed",
      message: "Checkup complete.",
      metadata: {
        overall: report.overall,
        pagesChecked: report.crawl.pagesChecked,
        websiteType,
      },
    });

    return {
      key: row.id,
      website: row.website,
      websiteType,
      overall: report.overall,
      pagesChecked: report.crawl.pagesChecked,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setCheckupProgress(input.workflowId, {
      status: "failed",
      phase: "failed",
      currentPageUrl: null,
      error: message,
    });
    await appendCheckupRunEvent(input.workflowId, {
      phase: "failed",
      type: "failed",
      message,
    });
    throw err;
  }
}
