"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { FixRunIntake, FixRunState } from "@repo/types/fix"
import {
  startFix,
  getFixRuns,
  getFixRun,
  submitFixIntake,
  sendFixMessage,
} from "@/lib/api"

const TERMINAL: FixRunState[] = ["PR_OPENED", "COMPLETED", "FAILED"]

// Start a fix run for { website, repositoryId }.
export function useStartFix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      website,
      repositoryId,
      orderId,
    }: {
      website: string
      repositoryId: string
      orderId: string
    }) => startFix(website, repositoryId, orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fix-runs"] })
      // An attempt was consumed — refresh the order's usage.
      qc.invalidateQueries({ queryKey: ["billing-history"] })
    },
  })
}

export function useSubmitFixIntake(runId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (intake: FixRunIntake) => submitFixIntake(runId, intake),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fix-runs"] })
      qc.invalidateQueries({ queryKey: ["fix-run", runId] })
    },
  })
}

// Send an open-ended follow-up message to the agent after the PR is open.
export function useSendFixMessage(runId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => sendFixMessage(runId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fix-runs"] })
      qc.invalidateQueries({ queryKey: ["fix-run", runId] })
      // A message was consumed — refresh the order's usage.
      qc.invalidateQueries({ queryKey: ["billing-history"] })
    },
  })
}

// Centralized poll: all of the user's runs. Polls while any run is active.
export function useFixRuns(enabled = true) {
  return useQuery({
    queryKey: ["fix-runs"],
    queryFn: getFixRuns,
    enabled,
    refetchInterval: (query) => {
      const runs = query.state.data ?? []
      const anyActive = runs.some((r) => !TERMINAL.includes(r.state))
      return anyActive ? 2000 : false
    },
  })
}

// One run's detail (checks + events). Polls while the run is active.
export function useFixRun(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ["fix-run", id],
    queryFn: () => getFixRun(id as string),
    enabled: enabled && !!id,
    refetchInterval: (query) => {
      const state = query.state.data?.state
      return state && TERMINAL.includes(state) ? false : 2000
    },
  })
}
