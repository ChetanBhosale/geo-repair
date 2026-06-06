import type { Request, Response } from "express";
import { prisma } from "@repo/db";
import {
  getCheckupReport,
  getCheckupStatus,
  startCheckup,
} from "../temporal";
import { SCAN_CACHE_TTL_HOURS } from "../billing/entitlements";
import {
  consumeScanQuota,
  getScanQuota,
  refundScanQuota,
  scanSubject,
} from "./scan-quota";
import { normalizeWebsite } from "../lib/url";

// A recently completed scan of this site that can be reused instead of running
// (and charging quota for) a fresh scan. Returns the cached run's workflowId so
// the client's normal poll resolves immediately (getCheckupStatus is DB-first
// for completed runs, so this works even after Temporal GCs the old workflow).
async function freshCachedRun(
  website: string,
): Promise<{ workflowId: string } | null> {
  const run = await prisma.checkupRun.findFirst({
    where: { website, status: "completed", resultKey: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { workflowId: true, resultKey: true, updatedAt: true },
  });
  if (!run?.resultKey) return null;

  const ageMs = Date.now() - run.updatedAt.getTime();
  if (ageMs > SCAN_CACHE_TTL_HOURS * 60 * 60 * 1000) return null;

  const report = await prisma.checkupReport.findUnique({
    where: { id: run.resultKey },
    select: { id: true },
  });
  return report ? { workflowId: run.workflowId } : null;
}

// POST /api/checkups { url, singlePage? } -> { workflowId, website, cached? }
export async function createCheckup(req: Request, res: Response) {
  const { url, singlePage } = req.body as {
    url?: string;
    singlePage?: boolean;
  };

  const website = url ? normalizeWebsite(url) : null;
  if (!website) {
    return res.status(400).json({ error: "A valid website url is required" });
  }

  // 1. Cache: a re-scan within the TTL reuses the existing report and costs no
  //    quota.
  const cached = await freshCachedRun(website);
  if (cached) {
    return res
      .status(202)
      .json({ workflowId: cached.workflowId, website, cached: true });
  }

  // 2. Quota: bounded per signed-in user, or per IP for anonymous visitors.
  const subject = scanSubject(req);
  const quota = await consumeScanQuota(subject);
  if (!quota) {
    return res.status(429).json({
      error:
        subject.scope === "USER"
          ? "You have used all your free scans for today. They reset at midnight UTC."
          : "You have reached today's free scan limit. Sign in for more scans, or try again tomorrow.",
      scope: subject.scope,
    });
  }

  // 3. Start the scan; refund the quota if it fails to launch.
  const meta = {
    ip: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
    referer: req.get("referer") ?? undefined,
    origin: req.get("origin") ?? undefined,
  };

  try {
    const workflowId = await startCheckup(website, Boolean(singlePage), meta);
    return res.status(202).json({ workflowId, website });
  } catch (err) {
    await refundScanQuota(subject);
    return res.status(502).json({
      error:
        err instanceof Error ? err.message : "Failed to start the checkup.",
    });
  }
}

// GET /api/scan-quota -> the visitor's remaining free scans today.
export async function getScanQuotaStatus(req: Request, res: Response) {
  const quota = await getScanQuota(scanSubject(req));
  return res.json(quota);
}

// GET /api/checkups/:workflowId/status -> lifecycle status + progress.
export async function getCheckupStatusById(req: Request, res: Response) {
  const workflowId = req.params.workflowId;

  if (!workflowId || typeof workflowId !== "string") {
    return res.status(400).json({ error: "workflowId is required" });
  }

  const result = await getCheckupStatus(workflowId);

  if (result.status === "NOT_FOUND") {
    return res.status(404).json({ error: "No checkup found for that id" });
  }

  return res.json(result);
}

// GET /api/checkup-reports/:key -> the full saved report from the DB.
export async function getCheckupReportByKey(req: Request, res: Response) {
  const key = req.params.key;

  if (!key || typeof key !== "string") {
    return res.status(400).json({ error: "key is required" });
  }

  const result = await getCheckupReport(key);

  if (!result) {
    return res
      .status(404)
      .json({ error: "No checkup report found for that key" });
  }

  return res.json(result);
}
