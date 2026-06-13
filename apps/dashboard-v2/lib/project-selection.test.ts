import { describe, expect, test } from "bun:test"
import type { Project } from "@repo/types/project"

import {
  selectedProjectForDashboardPath,
  slugFromDashboardPath,
} from "./project-selection"

function project(input: Pick<Project, "id" | "slug"> & Partial<Project>): Project {
  return {
    githubRepoId: 1,
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
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt: "2026-06-13T00:00:00.000Z",
    ...input,
  }
}

describe("dashboard project selection", () => {
  const first = project({ id: "p1", slug: "first" })
  const selected = project({ id: "p2", slug: "selected", selected: true })
  const routeProject = project({ id: "p3", slug: "route-project" })

  test("extracts the project slug from clean dashboard URLs", () => {
    expect(slugFromDashboardPath("/dashboard/route-project/scans")).toBe(
      "route-project"
    )
    expect(slugFromDashboardPath("/dashboard/projects")).toBeNull()
  })

  test("prefers the project in the current clean URL", () => {
    expect(
      selectedProjectForDashboardPath(
        [first, selected, routeProject],
        selected,
        "/dashboard/route-project/settings"
      )?.id
    ).toBe("p3")
  })

  test("falls back to selected project, then first project", () => {
    expect(
      selectedProjectForDashboardPath([first, selected], null, "/dashboard")?.id
    ).toBe("p2")
    expect(selectedProjectForDashboardPath([first], null, "/dashboard")?.id).toBe(
      "p1"
    )
  })
})
