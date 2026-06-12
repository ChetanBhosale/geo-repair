import { describe, expect, test } from "bun:test"

import { authLoginUrl, safeDashboardRedirectPath } from "./auth-redirect"

describe("safeDashboardRedirectPath", () => {
  test("keeps dashboard paths with query strings", () => {
    expect(
      safeDashboardRedirectPath(
        "/dashboard/projects?website=https%3A%2F%2Flinkrunner.io%2F"
      )
    ).toBe("/dashboard/projects?website=https%3A%2F%2Flinkrunner.io%2F")
  })

  test("falls back for unsafe redirects", () => {
    expect(safeDashboardRedirectPath("https://evil.example")).toBe("/dashboard")
    expect(safeDashboardRedirectPath("//evil.example")).toBe("/dashboard")
    expect(safeDashboardRedirectPath("/sign-in?next=/dashboard")).toBe(
      "/dashboard"
    )
  })
})

describe("authLoginUrl", () => {
  test("passes redirect_to to the backend OAuth route", () => {
    expect(
      authLoginUrl(
        "http://localhost:4000/api/auth/google",
        "/dashboard/projects?website=https%3A%2F%2Flinkrunner.io%2F"
      )
    ).toBe(
      "http://localhost:4000/api/auth/google?redirect_to=%2Fdashboard%2Fprojects%3Fwebsite%3Dhttps%253A%252F%252Flinkrunner.io%252F"
    )
  })
})
