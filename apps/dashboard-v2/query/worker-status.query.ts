"use client"

import { useQuery } from "@tanstack/react-query"
import { getWorkerStatus, reconcileWorker } from "@/lib/api"

// API 1: active (QUEUED/RUNNING) workers. Pass a projectId to scope, omit for
// the global cross-project view. Polls every 3s, including in the background.
export function useActiveWorkers(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ["worker-status", projectId ?? "all"],
    queryFn: () => getWorkerStatus(projectId),
    enabled,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  })
}

export { reconcileWorker }
