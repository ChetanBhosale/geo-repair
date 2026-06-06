import type { FixRunDetail, FixRunState, RunEventView } from "@repo/types/fix"
import type { DashboardBadgeVariant } from "@/lib/dashboard-format"

// The right-hand artifact panel: the real code Diff is the hero, Checks shows
// the rubric plan + status, and Cost is a dev-only breakdown. Console/Logs/
// Terminal are intentionally gone — that detail now lives in the agent chat.
export type ArtifactTab = "diff" | "checks" | "cost"

const internalCostTab =
  process.env.NODE_ENV !== "production"
    ? [{ id: "cost" as const, label: "Cost" }]
    : []

export const artifactTabs: Array<{ id: ArtifactTab; label: string }> = [
  { id: "diff", label: "Diff" },
  { id: "checks", label: "Checks" },
  ...internalCostTab,
]

export const activeStates: FixRunState[] = [
  "QUEUED",
  "SCANNING",
  "CLONING",
  "WAITING_FOR_INPUT",
  "FIXING",
  "CHATTING",
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

// ── Diff parsing ────────────────────────────────────────────────────────────
// The backend logs a `diff_summary` event with { stat, nameStatus, patch,
// truncated } from `git diff` against the default branch. We parse that into a
// readable per-file structure the Diff tab renders (no syntax-highlight deps).

export interface DiffFile {
  status: string // single letter: A(dded) M(odified) D(eleted) R(enamed) ...
  path: string
  oldPath: string | null // for renames/copies
  patch: string // the per-file unified diff slice (starts at "diff --git")
  additions: number
  deletions: number
}

export interface ParsedDiff {
  files: DiffFile[]
  additions: number
  deletions: number
  truncated: boolean
  patch: string
}

export function parseDiffSummary(
  payload: Record<string, unknown> | null,
): ParsedDiff {
  const patch = typeof payload?.patch === "string" ? payload.patch : ""
  const nameStatus =
    typeof payload?.nameStatus === "string" ? payload.nameStatus : ""
  const stat = typeof payload?.stat === "string" ? payload.stat : ""
  const truncated = payload?.truncated === true

  // status (+ rename old path) keyed by the file's current path.
  const statusByPath = new Map<string, { status: string; oldPath: string | null }>()
  for (const line of nameStatus.split("\n")) {
    const trimmed = line.replace(/\s+$/, "")
    if (!trimmed) continue
    const parts = trimmed.split("\t")
    const code = parts[0] ?? ""
    const status = (code.charAt(0) || "M").toUpperCase()
    if (status === "R" || status === "C") {
      const oldPath = parts[1] ?? ""
      const newPath = parts[2] ?? parts[1] ?? ""
      if (newPath) statusByPath.set(newPath, { status, oldPath: oldPath || null })
    } else {
      const path = parts[1] ?? ""
      if (path) statusByPath.set(path, { status, oldPath: null })
    }
  }

  // Split the unified patch into per-file chunks on the `diff --git` boundary.
  const files: DiffFile[] = []
  if (patch.trim()) {
    const chunks = patch.split(/^diff --git /m)
    for (const raw of chunks) {
      if (!raw.trim()) continue
      const chunk = `diff --git ${raw}`.replace(/\n+$/, "\n")
      const path = extractPathFromChunk(chunk)
      let additions = 0
      let deletions = 0
      for (const l of chunk.split("\n")) {
        if (l.startsWith("+") && !l.startsWith("+++")) additions++
        else if (l.startsWith("-") && !l.startsWith("---")) deletions++
      }
      const meta = statusByPath.get(path)
      files.push({
        status: meta?.status ?? "M",
        path,
        oldPath: meta?.oldPath ?? null,
        patch: chunk.replace(/\n$/, ""),
        additions,
        deletions,
      })
    }
  }

  // Fallback: nameStatus present but no patch (binary files / truncated early).
  if (files.length === 0 && statusByPath.size > 0) {
    for (const [path, meta] of statusByPath) {
      files.push({
        status: meta.status,
        path,
        oldPath: meta.oldPath,
        patch: "",
        additions: 0,
        deletions: 0,
      })
    }
  }

  const totals = parseStatTotals(stat)
  const additions =
    totals?.additions ?? files.reduce((sum, f) => sum + f.additions, 0)
  const deletions =
    totals?.deletions ?? files.reduce((sum, f) => sum + f.deletions, 0)

  return { files, additions, deletions, truncated, patch }
}

// The latest committed diff for a run, parsed — or null before the first commit.
export function diffSummaryFromDetail(detail: FixRunDetail): ParsedDiff | null {
  const diffEvent = detail.events
    .slice()
    .reverse()
    .find((event) => event.type === "diff_summary")
  if (!diffEvent) return null
  return parseDiffSummary(eventPayload(diffEvent))
}

function extractPathFromChunk(chunk: string): string {
  const plus = chunk.match(/^\+\+\+ b\/(.+)$/m)
  if (plus?.[1] && plus[1] !== "/dev/null") return plus[1].trim()
  const minus = chunk.match(/^--- a\/(.+)$/m)
  if (minus?.[1] && minus[1] !== "/dev/null") return minus[1].trim()
  const gitLine = chunk.match(/^diff --git a\/(.+?) b\/(.+)$/m)
  if (gitLine) return (gitLine[2] ?? gitLine[1] ?? "").trim()
  return "unknown"
}

function parseStatTotals(
  stat: string,
): { additions: number; deletions: number } | null {
  const ins = stat.match(/(\d+) insertions?\(\+\)/)
  const del = stat.match(/(\d+) deletions?\(-\)/)
  if (!ins && !del) return null
  return {
    additions: ins ? parseInt(ins[1] ?? "0", 10) : 0,
    deletions: del ? parseInt(del[1] ?? "0", 10) : 0,
  }
}
