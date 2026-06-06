"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createAudit,
  getTemporalStatus,
  getAuditResult,
  type TemporalStatus,
} from "@/lib/api"

const STORAGE_KEY = "geo-repair:dashboard:last-audit"

const TERMINAL: TemporalStatus["status"][] = [
  "COMPLETED",
  "FAILED",
  "TERMINATED",
  "CANCELED",
  "TIMED_OUT",
  "NOT_FOUND",
]

interface StoredAudit {
  temporalId: string | null
  resultKey: string | null
  url: string | null
}

function readStoredAudit(): StoredAudit {
  if (typeof window === "undefined") {
    return { temporalId: null, resultKey: null, url: null }
  }

  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEY) ?? "{}"
    ) as Partial<StoredAudit>

    return {
      temporalId:
        typeof parsed.temporalId === "string" ? parsed.temporalId : null,
      resultKey: typeof parsed.resultKey === "string" ? parsed.resultKey : null,
      url: typeof parsed.url === "string" ? parsed.url : null,
    }
  } catch {
    return { temporalId: null, resultKey: null, url: null }
  }
}

function writeStoredAudit(value: StoredAudit) {
  if (typeof window === "undefined") {
    return
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

export function useAudit() {
  const queryClient = useQueryClient()
  const [initialStoredAudit] = React.useState(() => readStoredAudit())
  const [persistedResultKey, setPersistedResultKey] = React.useState(
    initialStoredAudit.resultKey
  )
  const [temporalId, setTemporalId] = React.useState<string | null>(
    initialStoredAudit.temporalId
  )

  // 1) Start the audit.
  const start = useMutation({
    mutationFn: ({ url, singlePage }: { url: string; singlePage: boolean }) =>
      createAudit(url, singlePage),
    onSuccess: (data) => {
      setTemporalId(data.temporalId)
      setPersistedResultKey(null)
      writeStoredAudit({
        temporalId: data.temporalId,
        resultKey: null,
        url: data.website,
      })
      // A scan may have consumed quota (cache hits don't) — refresh the count.
      queryClient.invalidateQueries({ queryKey: ["scan-quota"] })
    },
  })

  // 2) Poll the workflow status until it reaches a terminal state.
  const status = useQuery({
    queryKey: ["temporal-status", temporalId],
    queryFn: () => getTemporalStatus(temporalId as string),
    enabled: !!temporalId,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s && TERMINAL.includes(s) ? false : 2000
    },
  })

  // 3) The result key is derived from the completed status, not mirrored into
  // state via an effect (avoids cascading renders).
  const resultKey =
    status.data?.status === "COMPLETED"
      ? status.data.result.key
      : persistedResultKey

  React.useEffect(() => {
    if (status.data?.status !== "COMPLETED") {
      return
    }

    writeStoredAudit({
      temporalId,
      resultKey: status.data.result.key,
      url: status.data.result.website,
    })
  }, [status.data, temporalId])

  // 4) Fetch the full saved report.
  const result = useQuery({
    queryKey: ["audit-result", resultKey],
    queryFn: () => getAuditResult(resultKey as string),
    enabled: !!resultKey,
  })

  const statusName = status.data?.status
  const isPolling =
    !!temporalId && !!statusName && !TERMINAL.includes(statusName)
  const failed =
    statusName === "FAILED" ||
    statusName === "TERMINATED" ||
    statusName === "CANCELED" ||
    statusName === "TIMED_OUT" ||
    statusName === "NOT_FOUND"

  return {
    start,
    statusName,
    isStarting: start.isPending,
    isPolling,
    failed,
    startError: start.error,
    result: result.data,
    progress: status.data?.progress ?? null,
    isLoadingResult: result.isLoading && !!resultKey,
  }
}
