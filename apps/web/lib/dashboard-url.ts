const DASHBOARD_URL = (
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "https://dashboard.geo.repair"
).replace(/\/+$/, "")

export const DASHBOARD_ONBOARDING_HREF = `${DASHBOARD_URL}/onboarding?next=${encodeURIComponent(
  "/website-scan"
)}`
