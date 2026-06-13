import type { Request, Response } from "express";
import {
  ScrapingError,
  getLatestScrapingForProject,
  getScrapingDetail,
  getScrapingDetailByProjectSlug,
  listActiveWorkerStatus,
  listScrapingsForProject,
  reconcileScraping,
  reconcileWorkerByWorkflowId,
  startScan,
} from "../functions/scraping.service";

// POST /api/projects/:id/scan
export async function postScan(req: Request, res: Response) {
  const userId = req.userId!;
  const projectId = String(req.params.id ?? "");
  try {
    const scraping = await startScan(userId, projectId);
    return res.status(202).json({ scraping });
  } catch (err) {
    if (err instanceof ScrapingError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to start scan",
    });
  }
}

// GET /api/projects/:id/scraping -> latest scraping (status, score, result, logs)
export async function getProjectScraping(req: Request, res: Response) {
  const userId = req.userId!;
  const projectId = String(req.params.id ?? "");
  const scraping = await getLatestScrapingForProject(userId, projectId);
  if (!scraping) return res.status(404).json({ error: "No scans yet" });
  return res.json({ scraping });
}

// GET /api/projects/:id/scrapings -> run history (summaries, newest first)
export async function getProjectScrapings(req: Request, res: Response) {
  const userId = req.userId!;
  const projectId = String(req.params.id ?? "");
  const scrapings = await listScrapingsForProject(userId, projectId);
  return res.json({ scrapings });
}

// GET /api/projects/:id/scrapings/:slug -> one scan detail by project-scoped slug
export async function getProjectScrapingBySlug(req: Request, res: Response) {
  const userId = req.userId!;
  const projectId = String(req.params.id ?? "");
  const slug = String(req.params.slug ?? "");
  const scraping = await getScrapingDetailByProjectSlug(
    userId,
    projectId,
    slug,
  );
  if (!scraping) return res.status(404).json({ error: "Scraping not found" });
  return res.json({ scraping });
}

// GET /api/worker-status?projectId=... -> active (QUEUED/RUNNING) workers
export async function getWorkerStatus(req: Request, res: Response) {
  const userId = req.userId!;
  const projectId = req.query.projectId
    ? String(req.query.projectId)
    : undefined;
  const workers = await listActiveWorkerStatus(userId, projectId);
  return res.json({ workers });
}

// GET /api/worker-status/:workflowId -> sync this workflow with Temporal and
// return the refreshed worker item (API 2 in the reconcile flow).
export async function getWorkerStatusByWorkflow(req: Request, res: Response) {
  const userId = req.userId!;
  const workflowId = String(req.params.workflowId ?? "");
  const worker = await reconcileWorkerByWorkflowId(userId, workflowId);
  if (!worker) return res.status(404).json({ error: "Worker not found" });
  return res.json({ worker });
}

// GET /api/scrapings/:id -> one scraping detail
export async function getScraping(req: Request, res: Response) {
  const userId = req.userId!;
  const id = String(req.params.id ?? "");
  const scraping = await getScrapingDetail(userId, id);
  if (!scraping) return res.status(404).json({ error: "Scraping not found" });
  return res.json({ scraping });
}

// GET /api/scrapings/:id/reconcile -> sync DB with Temporal, return detail
export async function getScrapingReconcile(req: Request, res: Response) {
  const userId = req.userId!;
  const id = String(req.params.id ?? "");
  const scraping = await reconcileScraping(userId, id);
  if (!scraping) return res.status(404).json({ error: "Scraping not found" });
  return res.json({ scraping });
}
