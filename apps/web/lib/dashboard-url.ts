const DASHBOARD_URL = (
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "https://dashboard.geo.repair"
).replace(/\/+$/, "")

export const DASHBOARD_ONBOARDING_HREF = `${DASHBOARD_URL}/onboarding?next=${encodeURIComponent(
  "/website-scan"
)}`

// "Start the fix" hand-off from a free homepage scan. Reuses the same onboarding
// entry point as every other CTA, but carries the scanned URL forward so the
// dashboard can pre-fill it once the user signs in and connects a repo. The
// `website` param is forward-compatible: the link still works if the dashboard
// doesn't consume it yet.
export function dashboardFixHref(website?: string): string {
  if (!website) return DASHBOARD_ONBOARDING_HREF
  return `${DASHBOARD_ONBOARDING_HREF}&website=${encodeURIComponent(website)}`
}
