"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { FixRunIntake, FixRunState } from "@repo/types/fix"
import { startFix, getFixRuns, getFixRun } from "@/lib/api"

const TERMINAL: FixRunState[] = ["PR_OPENED", "COMPLETED", "FAILED"]

// Start a fix run for { website, repositoryId }.
export function useStartFix() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      website,
      repositoryId,
      intake,
    }: {
      website: string
      repositoryId: string
      intake?: FixRunIntake
    }) => startFix(website, repositoryId, intake),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fix-runs"] }),
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
