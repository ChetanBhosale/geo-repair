"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { WorkerStatusItem } from "@repo/types/scraping"

import { reconcileWorker, useActiveWorkers } from "@/query/worker-status.query"

interface WorkerStatusContextValue {
  workers: WorkerStatusItem[]
  isLoading: boolean
  hasActive: boolean
  // Active workers for one project.
  forProject: (projectId: string) => WorkerStatusItem[]
}

const WorkerStatusContext = React.createContext<WorkerStatusContextValue | null>(
  null
)

// Holds the live cross-project active-worker list and drives the reconcile
// loop: every poll it asks Temporal (via API 2) for each active workflow's
// status so a finished/crashed run flips to COMPLETED/FAILED in the DB. The
// next poll then drops it from the active list. Mount once near the top of the
// authenticated dashboard.
export function WorkerStatusProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const qc = useQueryClient()
  const query = useActiveWorkers()
  const workers = React.useMemo(() => query.data ?? [], [query.data])

  // Reconcile is only a crash fallback (workers write status to the DB
  // themselves), so throttle it hard instead of firing on every 3s poll — that
  // multiplied requests per active worker and tripped the API rate limiter.
  const lastReconcileAt = React.useRef(0)
  const RECONCILE_EVERY_MS = 20_000

  React.useEffect(() => {
    const ids = workers
      .map((w) => w.temporalWorkflowId)
      .filter((id): id is string => !!id)
    if (ids.length === 0) return

    const now = Date.now()
    if (now - lastReconcileAt.current < RECONCILE_EVERY_MS) return
    lastReconcileAt.current = now

    let cancelled = false
    void (async () => {
      const results = await Promise.allSettled(ids.map((id) => reconcileWorker(id)))
      if (cancelled) return
      const settled = results.some(
        (r) =>
          r.status === "fulfilled" &&
          r.value &&
          r.value.status !== "RUNNING" &&
          r.value.status !== "QUEUED"
      )
      if (settled) {
        qc.invalidateQueries({ queryKey: ["worker-status"] })
        qc.invalidateQueries({ queryKey: ["scraping"] })
        qc.invalidateQueries({ queryKey: ["project-scraping"] })
        qc.invalidateQueries({ queryKey: ["project-scrapings"] })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [query.dataUpdatedAt, workers, qc])

  const value = React.useMemo<WorkerStatusContextValue>(
    () => ({
      workers,
      isLoading: query.isLoading,
      hasActive: workers.length > 0,
      forProject: (projectId: string) =>
        workers.filter((w) => w.projectId === projectId),
    }),
    [workers, query.isLoading]
  )

  return (
    <WorkerStatusContext.Provider value={value}>
      {children}
    </WorkerStatusContext.Provider>
  )
}

// Consume the live worker status. Pass a projectId to get only that project's
// active workers; omit for the global list.
export function useWorkerStatus(projectId?: string) {
  const ctx = React.useContext(WorkerStatusContext)
  if (!ctx) {
    throw new Error("useWorkerStatus must be used within a WorkerStatusProvider")
  }
  const scoped = React.useMemo(
    () => (projectId ? ctx.forProject(projectId) : ctx.workers),
    [ctx, projectId]
  )
  return {
    workers: scoped,
    isLoading: ctx.isLoading,
    hasActive: scoped.length > 0,
  }
}
