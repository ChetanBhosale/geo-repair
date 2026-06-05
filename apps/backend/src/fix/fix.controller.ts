import type { Request, Response } from "express";
import { startFix } from "../temporal";
import { listUserRuns, getRunDetail } from "./fix.service";

function normalizeWebsite(value: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return `${u.protocol}//${u.host}/`;
  } catch {
    return null;
  }
}

// POST /api/fix  { website, repositoryId } -> { fixRunId, temporalWorkflowId }
export async function createFix(req: Request, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { website, repositoryId } = req.body as { website?: string; repositoryId?: string };
  const normalized = website ? normalizeWebsite(website) : null;
  if (!normalized) {
    return res.status(400).json({ error: "A valid website url is required" });
  }
  if (!repositoryId) {
    return res.status(400).json({ error: "repositoryId is required" });
  }

  try {
    const result = await startFix({ userId, website: normalized, repositoryId });
    return res.status(202).json(result);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Failed to start fix" });
  }
}

// GET /api/fix-runs -> all of the user's runs (the centralized poll).
export async function listFixRuns(req: Request, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const runs = await listUserRuns(userId);
  return res.json({ runs });
}

// GET /api/fix/:fixRunId -> one run's full detail.
export async function getFixRun(req: Request, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const fixRunId = req.params.fixRunId;
  if (!fixRunId || typeof fixRunId !== "string") {
    return res.status(400).json({ error: "fixRunId is required" });
  }
  const detail = await getRunDetail(userId, fixRunId);
  if (!detail) {
    return res.status(404).json({ error: "Fix run not found" });
  }
  return res.json(detail);
}
