type DashboardEnv = {
  NEXT_PUBLIC_DASHBOARD_URL?: string
  NODE_ENV?: string
}

const LOCAL_DASHBOARD_URL = "http://localhost:3000"
const PRODUCTION_DASHBOARD_URL = "https://dashboard.geo.repair"

function dashboardEnv(): DashboardEnv {
  return {
    NEXT_PUBLIC_DASHBOARD_URL: process.env.NEXT_PUBLIC_DASHBOARD_URL,
    NODE_ENV: process.env.NODE_ENV,
  }
}

export function dashboardBaseUrl(env: DashboardEnv = dashboardEnv()): string {
  return (
    env.NEXT_PUBLIC_DASHBOARD_URL ??
    (env.NODE_ENV === "development"
      ? LOCAL_DASHBOARD_URL
      : PRODUCTION_DASHBOARD_URL)
  ).replace(/\/+$/, "")
}

const DASHBOARD_URL = dashboardBaseUrl()
export const DASHBOARD_DISPLAY_HOST = new URL(DASHBOARD_URL).host

export const DASHBOARD_PROJECTS_HREF = `${DASHBOARD_URL}/dashboard/projects`

// "Start the fix" hand-off from a free homepage scan. Carries the scanned URL
// forward so the dashboard can pre-fill it once the user signs in and connects
// a repo.
export function dashboardFixHref(website?: string, env?: DashboardEnv): string {
  const projectsHref = `${dashboardBaseUrl(env)}/dashboard/projects`
  if (!website) return projectsHref

  const url = new URL(projectsHref)
  url.searchParams.set("website", website)
  return url.toString()
}
