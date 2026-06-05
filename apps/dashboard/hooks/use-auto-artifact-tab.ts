"use client"

import * as React from "react"
import type { FixRunDetail } from "@repo/types/fix"
import type { ArtifactTab } from "@/lib/fix-run-view"

// Owns the artifact pane's active tab with "follow the agent" behavior: defaults
// to Checks while the run is pre-commit, then jumps to Diff the first time a
// commit lands — unless the user has manually picked a tab, in which case we
// never override. Resets (and re-enables follow) whenever the run changes.
export function useArtifactTab(detail: FixRunDetail | null, runId: string | null) {
  const [activeTab, setActiveTab] = React.useState<ArtifactTab>("checks")
  const pinned = React.useRef(false)
  const sawDiff = React.useRef(false)
  const lastRun = React.useRef<string | null>(null)

  const hasDiff = !!detail?.events.some((event) => event.type === "diff_summary")

  React.useEffect(() => {
    if (lastRun.current !== runId) {
      // New run selected: re-enable auto-follow and reveal the most useful tab.
      lastRun.current = runId
      pinned.current = false
      sawDiff.current = hasDiff
      setActiveTab(hasDiff ? "diff" : "checks")
      return
    }
    if (hasDiff && !pinned.current && !sawDiff.current) {
      sawDiff.current = true
      setActiveTab("diff")
    }
  }, [runId, hasDiff])

  const selectTab = React.useCallback((tab: ArtifactTab) => {
    pinned.current = true
    setActiveTab(tab)
  }, [])

  return { activeTab, selectTab }
}
