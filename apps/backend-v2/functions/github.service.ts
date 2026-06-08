import { prisma } from "@repo/db";
import type { GithubRepo } from "@repo/types/github"
import type { LinkedAccount } from "@repo/types/project"

// The user's linked GitHub account (id + token), or null if not connected.
export async function getGithubAccount(userId: string) {
  return prisma.account.findUnique({
    where: { userId_provider: { userId, provider: "GITHUB" } },
    select: { id: true, accessToken: true },
  });
}

// All providers the user has linked (for "GitHub connected?" checks in the UI).
export async function listLinkedAccounts(
  userId: string,
): Promise<LinkedAccount[]> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { provider: true, username: true, email: true, avatarUrl: true },
    orderBy: { createdAt: "asc" },
  });
  return accounts.map((a) => ({
    provider: a.provider,
    username: a.username,
    email: a.email,
    avatarUrl: a.avatarUrl,
  }));
}

interface GithubApiRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  updated_at: string;
  owner: { login: string; avatar_url: string };
}

// Lists the authenticated user's repositories (most recently updated first).
export async function listUserRepos(token: string): Promise<GithubRepo[]> {
  const res = await fetch(
    "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "geo-repair",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!res.ok) {
    throw new Error(`GitHub repos fetch failed: ${res.status}`);
  }

  const repos = (await res.json()) as GithubApiRepo[];

  return repos.map((r) => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    htmlUrl: r.html_url,
    cloneUrl: r.clone_url,
    description: r.description,
    defaultBranch: r.default_branch,
    language: r.language,
    updatedAt: r.updated_at,
    owner: { login: r.owner.login, avatarUrl: r.owner.avatar_url },
  }));
}
