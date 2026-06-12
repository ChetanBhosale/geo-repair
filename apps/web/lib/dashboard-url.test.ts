import { describe, expect, test } from "bun:test"

import { dashboardBaseUrl, dashboardFixHref } from "./dashboard-url"

describe("dashboardBaseUrl", () => {
  test("uses the configured public dashboard URL first", () => {
    expect(
      dashboardBaseUrl({
        NEXT_PUBLIC_DASHBOARD_URL: "http://localhost:3333/",
        NODE_ENV: "development",
      })
    ).toBe("http://localhost:3333")
  })

  test("defaults local development handoffs to the local dashboard", () => {
    expect(dashboardBaseUrl({ NODE_ENV: "development" })).toBe(
      "http://localhost:3000"
    )
  })

  test("defaults production handoffs to the production dashboard", () => {
    expect(dashboardBaseUrl({ NODE_ENV: "production" })).toBe(
      "https://dashboard.geo.repair"
    )
  })

  test("builds the local fix handoff on the dashboard projects route", () => {
    expect(
      dashboardFixHref("https://linkrunner.io/", { NODE_ENV: "development" })
    ).toBe(
      "http://localhost:3000/dashboard/projects?website=https%3A%2F%2Flinkrunner.io%2F"
    )
  })
})
