import { describe, expect, test } from "bun:test"
import {
  oldAgentRunPath,
  projectAgentRunPath,
  projectOverviewPath,
  projectScanPath,
  routeWithQuery,
} from "./project-routes"

describe("project dashboard routes", () => {
  const project = { slug: "linkrunner" }

  test("builds clean project paths", () => {
    expect(projectOverviewPath(project)).toBe("/dashboard/linkrunner")
    expect(projectScanPath(project, { slug: "scan-2" })).toBe(
      "/dashboard/linkrunner/scans/scan-2"
    )
    expect(projectAgentRunPath(project, { slug: "fix-1" })).toBe(
      "/dashboard/linkrunner/fix-agent/fix-1"
    )
  })

  test("keeps old id paths available for redirects", () => {
    expect(oldAgentRunPath("project id", "agent/id")).toBe(
      "/dashboard/projects/project%20id/agent/agent%2Fid"
    )
  })

  test("preserves query strings", () => {
    expect(routeWithQuery("/dashboard/linkrunner", "order_id=ord_1")).toBe(
      "/dashboard/linkrunner?order_id=ord_1"
    )
  })
})
