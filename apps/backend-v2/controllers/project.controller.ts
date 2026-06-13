import type { Request, Response } from "express";
import { CreateProjectRequestSchema } from "@repo/types/project";
import {
  ProjectError,
  createProject,
  deleteProject,
  getProject,
  getProjectBySlug,
  getSelectedProject,
  listProjects,
  selectProject,
} from "../functions/project.service";
import { startScan } from "../functions/scraping.service";

// POST /api/projects — create a project from a picked repo + website (both required).
export async function postProject(req: Request, res: Response) {
  const userId = req.userId!;
  const parsed = CreateProjectRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid project payload." });
  }

  try {
    const project = await createProject(userId, parsed.data);
    // Auto-start the first scan in the background. Best-effort: a failure to
    // enqueue must not fail project creation.
    try {
      await startScan(userId, project.id);
    } catch {
      // Swallow; the user can trigger a scan manually from the project page.
    }
    return res.status(201).json({ project });
  } catch (err) {
    if (err instanceof ProjectError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("[projects] Failed to create project:", err);
    return res.status(500).json({ error: "Failed to create project." });
  }
}

// GET /api/projects — all of the user's projects.
export async function getProjects(req: Request, res: Response) {
  const userId = req.userId!;
  const projects = await listProjects(userId);
  return res.json({ projects });
}

// GET /api/projects/selected — selected project for this user, with fallback.
export async function getSelectedProjectForUser(req: Request, res: Response) {
  const userId = req.userId!;
  const project = await getSelectedProject(userId);
  if (!project) return res.status(404).json({ error: "Project not found" });
  return res.json({ project });
}

// GET /api/projects/by-slug/:slug — one project by stable user-scoped slug.
export async function getProjectBySlugForUser(req: Request, res: Response) {
  const userId = req.userId!;
  const slug = String(req.params.slug ?? "");
  if (!slug) return res.status(400).json({ error: "slug is required" });

  const project = await getProjectBySlug(userId, slug);
  if (!project) return res.status(404).json({ error: "Project not found" });
  return res.json({ project });
}

// GET /api/projects/:id — one project.
export async function getProjectById(req: Request, res: Response) {
  const userId = req.userId!;
  const id = String(req.params.id ?? "");
  if (!id) return res.status(400).json({ error: "id is required" });

  const project = await getProject(userId, id);
  if (!project) return res.status(404).json({ error: "Project not found" });
  return res.json({ project });
}

// POST /api/projects/:id/select — make this project the selected dashboard context.
export async function selectProjectById(req: Request, res: Response) {
  const userId = req.userId!;
  const id = String(req.params.id ?? "");
  if (!id) return res.status(400).json({ error: "id is required" });

  try {
    const project = await selectProject(userId, id);
    return res.json({ project });
  } catch (err) {
    if (err instanceof ProjectError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to select project",
    });
  }
}

// DELETE /api/projects/:id — soft-delete the project and purge its scans/logs.
export async function deleteProjectById(req: Request, res: Response) {
  const userId = req.userId!;
  const id = String(req.params.id ?? "");
  if (!id) return res.status(400).json({ error: "id is required" });

  try {
    await deleteProject(userId, id);
    return res.json({ success: true });
  } catch (err) {
    if (err instanceof ProjectError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to delete project",
    });
  }
}
