"use client"

import { Loader2 } from "lucide-react"
import type { FixRunSummary } from "@repo/types/fix"
import { stateLabel } from "@/lib/fix-run-view"

// Compact header control for switching between past runs — keeps run history out
// of the two-pane body.
export function RunSwitcher({
  runs,
  isLoading,
  selectedRunId,
  onSelectRun,
}: {
  runs: FixRunSummary[]
  isLoading: boolean
  selectedRunId: string | null
  onSelectRun: (runId: string) => void
}) {
  if (!runs.length) {
    return isLoading ? (
      <span className="inline-flex items-center gap-2 text-xs text-secondary">
        <Loader2 className="size-4 animate-spin" />
        Loading runs
      </span>
    ) : null
  }

  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return (
    <select
      aria-label="Select run"
      className="h-8 max-w-[280px] truncate rounded-full bg-secondary/70 px-3 text-xs outline-none hover:bg-secondary focus-visible:ring-1 focus-visible:ring-focus/50"
      onChange={(event) => onSelectRun(event.target.value)}
      value={selectedRunId ?? ""}
    >
      {sorted.map((run) => (
        <option key={run.id} value={run.id}>
          {hostLabel(run.website)} · {stateLabel(run.state)}
        </option>
      ))}
    </select>
  )
}

function hostLabel(website: string): string {
  return website.replace(/^https?:\/\//, "").replace(/\/$/, "")
}
