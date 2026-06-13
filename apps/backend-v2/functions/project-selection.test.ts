import { beforeEach, describe, expect, mock, test } from "bun:test";

type ProjectRow = {
  id: string;
  userId: string;
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
  websiteUrl: string;
  websiteVerified: boolean;
  brandName: string | null;
  faviconUrl: string | null;
  logoUrl: string | null;
  brandUpdatedAt: Date | null;
  selected: boolean;
  createdAt: Date;
  updatedAt: Date;
};

let projects: ProjectRow[] = [];

function projectRow(
  input: Partial<ProjectRow> & Pick<ProjectRow, "id" | "userId" | "slug">,
): ProjectRow {
  const now = new Date("2026-06-13T00:00:00.000Z");
  return {
    githubRepoId: BigInt(1),
    name: input.slug,
    fullName: `ajay/${input.slug}`,
    owner: "ajay",
    private: false,
    htmlUrl: `https://github.com/ajay/${input.slug}`,
    cloneUrl: `https://github.com/ajay/${input.slug}.git`,
    defaultBranch: "main",
    description: null,
    language: "TypeScript",
    websiteUrl: `https://${input.slug}.test`,
    websiteVerified: true,
    brandName: null,
    faviconUrl: null,
    logoUrl: null,
    brandUpdatedAt: null,
    selected: false,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}

function matchProject(
  row: ProjectRow,
  where: {
    id?: string | { not?: string };
    userId?: string;
    selected?: boolean;
  },
) {
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if (where.selected !== undefined && row.selected !== where.selected) {
    return false;
  }
  if (typeof where.id === "string" && row.id !== where.id) return false;
  if (typeof where.id === "object" && where.id.not && row.id === where.id.not) {
    return false;
  }
  return true;
}

mock.module("@repo/db", () => ({
  prisma: {
    project: {
      async findFirst(args: {
        where: Parameters<typeof matchProject>[1];
        orderBy?: { updatedAt?: "desc" | "asc" };
      }) {
        const rows = projects.filter((row) => matchProject(row, args.where));
        if (args.orderBy?.updatedAt === "desc") {
          rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        }
        return rows[0] ?? null;
      },
      async findUnique(args: {
        where: { userId_slug?: { userId: string; slug: string } };
      }) {
        const lookup = args.where.userId_slug;
        if (!lookup) return null;
        return (
          projects.find(
            (row) => row.userId === lookup.userId && row.slug === lookup.slug,
          ) ?? null
        );
      },
      async update(args: { where: { id: string }; data: Partial<ProjectRow> }) {
        const row = projects.find((project) => project.id === args.where.id);
        if (!row) throw new Error("Project not found");
        Object.assign(row, args.data);
        return row;
      },
      async updateMany(args: {
        where: Parameters<typeof matchProject>[1];
        data: Partial<ProjectRow>;
      }) {
        let count = 0;
        for (const row of projects) {
          if (!matchProject(row, args.where)) continue;
          Object.assign(row, args.data);
          count += 1;
        }
        return { count };
      },
    },
    async $transaction<T>(items: Promise<T>[]) {
      return Promise.all(items);
    },
  },
}));

const {
  ProjectError,
  getProject,
  getProjectBySlug,
  getSelectedProject,
  selectProject,
} = await import("./project.service");

describe("project selection and slug lookup", () => {
  beforeEach(() => {
    projects = [
      projectRow({
        id: "p1",
        userId: "u1",
        slug: "old-site",
        selected: false,
        updatedAt: new Date("2026-06-12T00:00:00.000Z"),
      }),
      projectRow({
        id: "p2",
        userId: "u1",
        slug: "new-site",
        selected: false,
        updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      }),
      projectRow({
        id: "p3",
        userId: "u2",
        slug: "new-site",
        selected: true,
      }),
    ];
  });

  test("falls back to the user's most recently updated project", async () => {
    const selected = await getSelectedProject("u1");

    expect(selected?.id).toBe("p2");
    expect(projects.find((project) => project.id === "p2")?.selected).toBe(
      true,
    );
    expect(projects.find((project) => project.id === "p1")?.selected).toBe(
      false,
    );
  });

  test("selects one project per user", async () => {
    projects[0]!.selected = true;

    const selected = await selectProject("u1", "p2");

    expect(selected.id).toBe("p2");
    expect(projects.find((project) => project.id === "p1")?.selected).toBe(
      false,
    );
    expect(projects.find((project) => project.id === "p2")?.selected).toBe(
      true,
    );
    expect(projects.find((project) => project.id === "p3")?.selected).toBe(
      true,
    );
  });

  test("resolves project slugs within the current user", async () => {
    const project = await getProjectBySlug("u1", "new-site");

    expect(project?.id).toBe("p2");
  });

  test("keeps old id resolution scoped and returns redirect slug data", async () => {
    const project = await getProject("u1", "p1");

    expect(project?.slug).toBe("old-site");
    expect(await getProject("u1", "p3")).toBeNull();
  });

  test("rejects selection for projects owned by another user", async () => {
    await expect(selectProject("u1", "p3")).rejects.toBeInstanceOf(
      ProjectError,
    );
  });
});
