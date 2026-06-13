import { prisma } from "@repo/db";
import type { CreateProjectRequest, Project } from "@repo/types/project";
import { projectSlugBase, uniqueSlug } from "@repo/types/slugs";
import { getGithubAccount } from "./github.service";

// Thrown for caller-fixable errors (missing GitHub link, etc.).
export class ProjectError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProjectError";
  }
}

type ProjectRow = {
  id: string;
  slug: string;
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
  websiteUrl: string | null;
  websiteVerified: boolean;
  brandName: string | null;
  faviconUrl: string | null;
  logoUrl: string | null;
  brandUpdatedAt: Date | null;
  selected: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    slug: row.slug,
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
    websiteUrl: row.websiteUrl,
    websiteVerified: row.websiteVerified,
    brandName: row.brandName,
    faviconUrl: row.faviconUrl,
    logoUrl: row.logoUrl,
    brandUpdatedAt: row.brandUpdatedAt?.toISOString() ?? null,
    selected: row.selected,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function nextProjectSlug(userId: string, value: string): Promise<string> {
  const base = projectSlugBase(value);
  const rows = await prisma.project.findMany({
    where: { userId },
    select: { slug: true },
  });
  return uniqueSlug(
    base,
    rows.map((row) => row.slug),
  );
}

// Create a project from a repo the user picked. Requires a linked GitHub
// account, since that account's token authorizes cloning + opening a PR. Fails
// if the repo is already a project (delete it first). Marks it as selected.
export async function createProject(
  userId: string,
  input: CreateProjectRequest,
): Promise<Project> {
  const account = await getGithubAccount(userId);
  if (!account) {
    throw new ProjectError(409, "Connect GitHub before creating a project.");
  }

  const githubRepoId = BigInt(input.githubRepoId);
  const existing = await prisma.project.findUnique({
    where: { userId_githubRepoId: { userId, githubRepoId } },
  });
  if (existing) {
    throw new ProjectError(
      409,
      "This repository is already added. Delete the existing project to add it again.",
    );
  }

  const slug = await nextProjectSlug(userId, input.name || input.fullName);

  const [, row] = await prisma.$transaction([
    prisma.project.updateMany({
      where: { userId, selected: true },
      data: { selected: false },
    }),
    prisma.project.create({
      data: {
        userId,
        slug,
        githubRepoId,
        accountId: account.id,
        name: input.name,
        fullName: input.fullName,
        owner: input.owner,
        private: input.private,
        htmlUrl: input.htmlUrl,
        cloneUrl: input.cloneUrl,
        defaultBranch: input.defaultBranch,
        description: input.description ?? null,
        language: input.language ?? null,
        websiteUrl: input.websiteUrl ?? null,
        selected: true,
      },
    }),
  ]);

  return toProject(row);
}

// Hard-delete a project and everything attached to it (scrapings, logs,
// worker-status) in one transaction. Blocked while a scan/job is still running.
export async function deleteProject(
  userId: string,
  projectId: string,
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new ProjectError(404, "Project not found.");

  const active = await prisma.workerStatus.count({
    where: { projectId, userId, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (active > 0) {
    throw new ProjectError(
      409,
      "A scan is still running for this project. Wait for it to finish before deleting.",
    );
  }

  await prisma.$transaction([
    prisma.log.deleteMany({ where: { projectId } }),
    prisma.workerStatus.deleteMany({ where: { projectId } }),
    prisma.scraping.deleteMany({ where: { projectId } }),
    prisma.project.delete({ where: { id: projectId } }),
  ]);
}

export async function listProjects(userId: string): Promise<Project[]> {
  const rows = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toProject);
}

export async function getSelectedProject(
  userId: string,
): Promise<Project | null> {
  const row = await prisma.project.findFirst({
    where: { userId, selected: true },
    orderBy: { updatedAt: "desc" },
  });
  if (row) return toProject(row);

  const fallback = await prisma.project.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return fallback ? selectProject(userId, fallback.id) : null;
}

export async function selectProject(
  userId: string,
  projectId: string,
): Promise<Project> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new ProjectError(404, "Project not found.");

  const [, row] = await prisma.$transaction([
    prisma.project.updateMany({
      where: { userId, selected: true, id: { not: projectId } },
      data: { selected: false },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: { selected: true },
    }),
  ]);

  return toProject(row);
}

export async function getProject(
  userId: string,
  projectId: string,
): Promise<Project | null> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  return row ? toProject(row) : null;
}

export async function getProjectBySlug(
  userId: string,
  slug: string,
): Promise<Project | null> {
  const row = await prisma.project.findUnique({
    where: { userId_slug: { userId, slug } },
  });
  return row ? toProject(row) : null;
}
