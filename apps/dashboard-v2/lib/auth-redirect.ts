const DEFAULT_DASHBOARD_PATH = "/dashboard"

export function safeDashboardRedirectPath(
  value: string | null | undefined
): string {
  const trimmed = value?.trim() ?? ""
  if (
    !trimmed ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    /[\r\n]/.test(trimmed) ||
    trimmed.startsWith("/sign-in")
  ) {
    return DEFAULT_DASHBOARD_PATH
  }
  return trimmed.slice(0, 512)
}

export function authLoginUrl(endpoint: string, redirectTo?: string): string {
  const url = new URL(endpoint)
  url.searchParams.set(
    "redirect_to",
    safeDashboardRedirectPath(redirectTo ?? DEFAULT_DASHBOARD_PATH)
  )
  return url.toString()
}

export function currentDashboardRedirectPath(): string {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_PATH
  return safeDashboardRedirectPath(
    `${window.location.pathname}${window.location.search}`
  )
}
