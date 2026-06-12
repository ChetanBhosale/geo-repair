import posthog from "posthog-js"

// The complete set of manual events we emit. Keep this union in sync with the
// taxonomy in the root AGENTS.md Analytics section. Autocapture covers generic
// clicks/links; these are the named events autocapture can't infer or where a
// labelled funnel event adds value.
export type AnalyticsEvent =
  | "waitlist_joined"
  | "cta_clicked"
  | "faq_opened"
  | "contact_submitted"
  | "nav_opened"
  | "checkup_started"
  | "checkup_completed"
  | "checkup_failed"
  | "report_downloaded"
  | "fix_started"

type AnalyticsProperties = Record<string, string | number | boolean | undefined>

/**
 * Fire a typed analytics event. Safe to call anywhere on the client: it no-ops
 * on the server and before PostHog has initialized (e.g. when no project key is
 * set), so callers never need to guard.
 */
export function capture(
  event: AnalyticsEvent,
  properties?: AnalyticsProperties
): void {
  if (typeof window === "undefined") return
  if (!posthog.__loaded) return
  posthog.capture(event, properties)
}
