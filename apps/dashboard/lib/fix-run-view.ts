import type { FixRunDetail, FixRunState, RunEventView } from "@repo/types/fix"
import type { DashboardBadgeVariant } from "@/lib/dashboard-format"

const internalCostTab =
  process.env.NODE_ENV !== "production"
    ? [{ id: "cost" as const, label: "Cost" }]
    : []

export type TechTab = "diff" | "console" | "logs" | "terminal" | "cost"

export const techTabs: Array<{ id: TechTab; label: string }> = [
  { id: "diff", label: "Diff" },
  { id: "console", label: "Console" },
  { id: "logs", label: "Logs" },
  { id: "terminal", label: "Terminal" },
  ...internalCostTab,
]

export const activeStates: FixRunState[] = [
  "QUEUED",
  "SCANNING",
  "CLONING",
  "FIXING",
  "VERIFYING",
  "PUSHING",
]

export function isActiveFixRun(state: FixRunState) {
  return activeStates.includes(state)
}

export function stateLabel(state: FixRunState) {
  return state.replaceAll("_", " ").toLowerCase()
}

export function stateVariant(state: FixRunState): DashboardBadgeVariant {
  if (state === "FAILED") {
    return "fail"
  }
  if (state === "PR_OPENED" || state === "COMPLETED") {
    return "pass"
  }
  return "partial"
}

export function eventPayload(event: RunEventView) {
  return event.payload ?? {}
}

export function eventBody(event: RunEventView) {
  const payload = eventPayload(event)
  const message =
    typeof payload.message === "string"
      ? payload.message
      : typeof payload.error === "string"
        ? payload.error
        : typeof payload.prUrl === "string"
          ? `Pull request opened: ${payload.prUrl}`
          : null

  return (
    message ??
    `Event ${event.type}${event.phase ? ` during ${event.phase}` : ""}.`
  )
}

export function eventStatus(event: RunEventView) {
  if (event.type.toLowerCase().includes("error")) {
    return "bg-danger/5"
  }
  if (event.type.toLowerCase().includes("pr")) {
    return "bg-success/5"
  }
  return "bg-primary"
}

export function commandFromEvent(event: RunEventView) {
  const payload = eventPayload(event)
  const args = payload.toolArgs
  if (args && typeof args === "object" && "command" in args) {
    const command = (args as { command?: unknown }).command
    return typeof command === "string" ? command : null
  }
  return null
}

export function diffPayloadFromDetail(detail: FixRunDetail) {
  const diffEvent = detail.events
    .slice()
    .reverse()
    .find((event) => event.type === "diff_summary")
  const diffPayload = diffEvent ? eventPayload(diffEvent) : null

  return {
    diffEvent,
    patch:
      diffPayload && typeof diffPayload.patch === "string"
        ? diffPayload.patch
        : null,
    stat:
      diffPayload && typeof diffPayload.stat === "string"
        ? diffPayload.stat
        : null,
    nameStatus:
      diffPayload && typeof diffPayload.nameStatus === "string"
        ? diffPayload.nameStatus
        : null,
  }
}

export function formatCostCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cents / 100)
}

export function formatRunDuration(seconds: number) {
  if (seconds <= 0) return "0s"
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes === 0) return `${remainingSeconds}s`
  return `${minutes}m ${remainingSeconds}s`
}
