import { prisma } from "@repo/db";
import type {
  GithubRepo,
  SavedRepository,
  SelectRepoRequest,
} from "@repo/types/github";

// Returns the stored GitHub access token for a user, or null if not connected.
export async function getGithubToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "GITHUB" },
    select: { accessToken: true },
  });
  return account?.accessToken ?? null;
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
    }
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

// Maps a DB repository row to the API shape (BigInt -> number, dates -> ISO).
function toSavedRepository(row: {
  id: string;
  githubRepoId: bigint;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  description: string | null;
  language: string | null;
  selected: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SavedRepository {
  return {
    id: row.id,
    githubRepoId: Number(row.githubRepoId),
    name: row.name,
    fullName: row.fullName,
    owner: row.owner,
    private: row.private,
    htmlUrl: row.htmlUrl,
    cloneUrl: row.cloneUrl,
    defaultBranch: row.defaultBranch,
    description: row.description,
    language: row.language,
    selected: row.selected,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Finds the user's GitHub account id (the Account row that owns the repo).
async function getGithubAccountId(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "GITHUB" },
    select: { id: true },
  });
  return account?.id ?? null;
}

// Saves the repo the user picked, marking it as the currently selected one
// (and de-selecting any previously selected repo). Idempotent per repo.
export async function saveSelectedRepo(
  userId: string,
  input: SelectRepoRequest
): Promise<SavedRepository> {
  const accountId = await getGithubAccountId(userId);
  if (!accountId) {
    throw new Error("GitHub account not connected");
  }

  const data = {
    accountId,
    name: input.name,
    fullName: input.fullName,
    owner: input.owner,
    private: input.private,
    htmlUrl: input.htmlUrl,
    cloneUrl: input.cloneUrl,
    defaultBranch: input.defaultBranch,
    description: input.description ?? null,
    language: input.language ?? null,
    selected: true,
  };

  const [, row] = await prisma.$transaction([
    // Only one repo is "selected" at a time per user.
    prisma.repository.updateMany({
      where: { userId, selected: true },
      data: { selected: false },
    }),
    prisma.repository.upsert({
      where: {
        userId_githubRepoId: { userId, githubRepoId: BigInt(input.githubRepoId) },
      },
      create: { userId, githubRepoId: BigInt(input.githubRepoId), ...data },
      update: data,
    }),
  ]);

  return toSavedRepository(row);
}

// Lists the repositories this user has saved (newest first).
export async function listSavedRepos(userId: string): Promise<SavedRepository[]> {
  const rows = await prisma.repository.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toSavedRepository);
}
