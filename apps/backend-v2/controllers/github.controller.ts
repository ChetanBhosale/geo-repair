import type { Request, Response } from "express";
import {
  getGithubAccount,
  listLinkedAccounts,
  listUserRepos,
} from "../functions/github.service";

// GET /api/github/repos — repos from the user's linked GitHub account.
export async function listRepos(req: Request, res: Response) {
  const userId = req.userId!;
  const account = await getGithubAccount(userId);
  if (!account?.accessToken) {
    return res.status(409).json({ error: "GitHub is not connected." });
  }

  try {
    const repos = await listUserRepos(account.accessToken);
    return res.json({ repos });
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : "Failed to load repositories",
    });
  }
}

// GET /api/auth/accounts — providers linked to the current user.
export async function listAccounts(req: Request, res: Response) {
  const userId = req.userId!;
  const accounts = await listLinkedAccounts(userId);
  return res.json({ accounts });
}
