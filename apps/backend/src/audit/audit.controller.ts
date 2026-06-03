import type { Request, Response } from "express";
import {
  startAudit,
  getAuditStatus,
  getAuditResult,
  getScrapeCount,
  MAX_SCRAPES_PER_SITE,
} from "../temporal";
import { normalizeWebsite } from "../lib/url";

// POST /api/audit  { url, singlePage? } -> { temporalId, website }
export async function createAudit(req: Request, res: Response) {
  const { url, singlePage } = req.body as { url?: string; singlePage?: boolean };

  // 1) Validate + normalize the URL down to its origin root.
  const website = url ? normalizeWebsite(url) : null;
  if (!website) {
    return res.status(400).json({ error: "A valid website url is required" });
  }

  // 2) Enforce the free-checkup limit per site.
  const count = await getScrapeCount(website);
  if (count >= MAX_SCRAPES_PER_SITE) {
    return res.status(429).json({
      error: `You already tested ${website} more than ${MAX_SCRAPES_PER_SITE} times. No more testing for this site.`,
      website,
      totalScrapeCount: count,
    });
  }

  // 3) Capture request metadata, then start the audit.
  const meta = {
    ip: req.ip,
    userAgent: req.get("user-agent") ?? undefined,
    referer: req.get("referer") ?? undefined,
    origin: req.get("origin") ?? undefined,
  };

  const temporalId = await startAudit(website, Boolean(singlePage), meta);
  return res.status(202).json({ temporalId, website });
}

// GET /api/temporal-status/:temporalId -> status (+ result when completed)
export async function getTemporalStatus(req: Request, res: Response) {
  const temporalId = req.params.temporalId;

  if (!temporalId || typeof temporalId !== "string") {
    return res.status(400).json({ error: "temporalId is required" });
  }

  const result = await getAuditStatus(temporalId);

  if (result.status === "NOT_FOUND") {
    return res.status(404).json({ error: "No audit found for that id" });
  }

  return res.json(result);
}

// GET /api/audit-result/:key -> the full saved report from the DB
export async function getAuditResultByKey(req: Request, res: Response) {
  const key = req.params.key;

  if (!key || typeof key !== "string") {
    return res.status(400).json({ error: "key is required" });
  }

  const result = await getAuditResult(key);

  if (!result) {
    return res.status(404).json({ error: "No audit result found for that key" });
  }

  return res.json(result);
}
