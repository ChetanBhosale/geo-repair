import type { Request, Response } from "express";
import type { SelectRepoRequest } from "@repo/types/github";
import {
  getGithubToken,
  listUserRepos,
  saveSelectedRepo,
  listSavedRepos,
} from "./github.service";

// GET /api/github/repos -> { repos } for the authenticated user.
export async function listRepos(req: Request, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const token = await getGithubToken(userId);
  if (!token) {
    return res.status(400).json({ error: "GitHub account not connected" });
  }

  try {
    const repos = await listUserRepos(token);
    return res.json({ repos });
  } catch (err) {
    console.error("[github] listRepos error:", err);
    return res.status(502).json({ error: "Failed to fetch repositories from GitHub" });
  }
}

// POST /api/github/repos/select -> save the repo the user picked.
export async function selectRepo(req: Request, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const body = req.body as Partial<SelectRepoRequest>;
  if (
    typeof body.githubRepoId !== "number" ||
    !body.fullName ||
    !body.name ||
    !body.owner ||
    !body.cloneUrl ||
    !body.defaultBranch ||
    !body.htmlUrl
  ) {
    return res.status(400).json({ error: "Missing required repository fields" });
  }

  try {
    const repository = await saveSelectedRepo(userId, body as SelectRepoRequest);
    return res.status(201).json({ repository });
  } catch (err) {
    console.error("[github] selectRepo error:", err);
    return res.status(502).json({ error: "Failed to save the selected repository" });
  }
}

// GET /api/github/repos/saved -> the user's saved repositories.
export async function listSaved(req: Request, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const repositories = await listSavedRepos(userId);
  return res.json({ repositories });
}
