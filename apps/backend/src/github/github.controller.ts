import type { Request, Response } from "express";
import type { SelectRepoRequest } from "@repo/types/github";
import { normalizeWebsite } from "../lib/url";
import {
  getGithubToken,
  listUserRepos,
  saveSelectedRepo,
  listSavedRepos,
  updateRepositoryWebsite,
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
    return res
      .status(502)
      .json({ error: "Failed to fetch repositories from GitHub" });
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
    return res
      .status(400)
      .json({ error: "Missing required repository fields" });
  }

  const parsedWebsite = parseOptionalWebsite(body.website);
  if (!parsedWebsite.ok) {
    return res.status(400).json({ error: "A valid website url is required" });
  }

  try {
    const repository = await saveSelectedRepo(userId, {
      ...(body as SelectRepoRequest),
      ...(parsedWebsite.website === undefined
        ? {}
        : { website: parsedWebsite.website }),
    });
    return res.status(201).json({ repository });
  } catch (err) {
    console.error("[github] selectRepo error:", err);
    return res
      .status(502)
      .json({ error: "Failed to save the selected repository" });
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

// PATCH /api/github/repos/:id/website -> bind/update the website for a repo.
export async function updateWebsite(req: Request, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const repositoryIdParam = req.params.id;
  const repositoryId = Array.isArray(repositoryIdParam)
    ? repositoryIdParam[0]
    : repositoryIdParam;
  if (!repositoryId) {
    return res.status(400).json({ error: "Missing repository id" });
  }

  const website = normalizeWebsite(
    (req.body as { website?: unknown }).website as string,
  );
  if (!website) {
    return res.status(400).json({ error: "A valid website url is required" });
  }

  try {
    const repository = await updateRepositoryWebsite(
      userId,
      repositoryId,
      website,
    );
    return res.json({ repository });
  } catch (err) {
    if (err instanceof Error && err.message === "Repository not found") {
      return res.status(404).json({ error: "Repository not found" });
    }

    console.error("[github] updateWebsite error:", err);
    return res
      .status(502)
      .json({ error: "Failed to update repository website" });
  }
}

function parseOptionalWebsite(
  value: unknown,
): { ok: true; website?: string | null } | { ok: false } {
  if (value === undefined || value === null || value === "") {
    return { ok: true };
  }

  if (typeof value !== "string") {
    return { ok: false };
  }

  const website = normalizeWebsite(value);
  return website ? { ok: true, website } : { ok: false };
}
