import type { Request, Response } from "express";
import {
  getCheckupCount,
  getCheckupReport,
  getCheckupStatus,
  MAX_CHECKUPS_PER_SITE,
  startCheckup,
} from "../temporal";
import { normalizeWebsite } from "../lib/url";

// POST /api/checkups { url, singlePage? } -> { workflowId, website }
export async function createCheckup(req: Request, res: Response) {
  const { url, singlePage } = req.body as {
    url?: string;
    singlePage?: boolean;
  };

  const website = url ? normalizeWebsite(url) : null;
  if (!website) {
    return res.status(400).json({ error: "A valid website url is required" });
  }

  const count = await getCheckupCount(website);
  if (count >= MAX_CHECKUPS_PER_SITE) {
    return res.status(429).json({
      error: `You already checked ${website} more than ${MAX_CHECKUPS_PER_SITE} times. No more free checkups for this site.`,
      website,
      totalCheckupCount: count,
    });
  }

  const meta = {
    ip: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
    referer: req.get("referer") ?? undefined,
    origin: req.get("origin") ?? undefined,
  };

  const workflowId = await startCheckup(website, Boolean(singlePage), meta);
  return res.status(202).json({ workflowId, website });
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
