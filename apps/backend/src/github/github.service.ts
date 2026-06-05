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
  website: string | null;
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
    website: row.website,
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
  input: SelectRepoRequest,
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
  const hasWebsite = Object.prototype.hasOwnProperty.call(input, "website");
  const website = hasWebsite ? (input.website ?? null) : undefined;

  const [, row] = await prisma.$transaction([
    // Only one repo is "selected" at a time per user.
    prisma.repository.updateMany({
      where: { userId, selected: true },
      data: { selected: false },
    }),
    prisma.repository.upsert({
      where: {
        userId_githubRepoId: {
          userId,
          githubRepoId: BigInt(input.githubRepoId),
        },
      },
      create:
        website === undefined
          ? { userId, githubRepoId: BigInt(input.githubRepoId), ...data }
          : {
              userId,
              githubRepoId: BigInt(input.githubRepoId),
              website,
              ...data,
            },
      update: website === undefined ? data : { ...data, website },
    }),
  ]);

  return toSavedRepository(row);
}

// Updates the website/domain bound to one saved repository.
export async function updateRepositoryWebsite(
  userId: string,
  repositoryId: string,
  website: string,
): Promise<SavedRepository> {
  const existing = await prisma.repository.findFirst({
    where: { id: repositoryId, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Repository not found");
  }

  const row = await prisma.repository.update({
    where: { id: existing.id },
    data: { website },
  });

  return toSavedRepository(row);
}

// Lists the repositories this user has saved (newest first).
export async function listSavedRepos(
  userId: string,
): Promise<SavedRepository[]> {
  try {
    const rows = await prisma.repository.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(toSavedRepository);
  } catch (err) {
    if (!isSchemaOutOfSyncError(err)) {
      throw err;
    }

    const rows = await prisma.repository.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        githubRepoId: true,
        name: true,
        fullName: true,
        owner: true,
        private: true,
        htmlUrl: true,
        cloneUrl: true,
        defaultBranch: true,
        description: true,
        language: true,
        selected: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return rows.map((row) => toSavedRepository({ ...row, website: null }));
  }
}

function isSchemaOutOfSyncError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return /column .*website.* does not exist|no such column.*website/i.test(
    message,
  );
}
