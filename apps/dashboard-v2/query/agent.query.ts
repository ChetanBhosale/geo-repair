"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { AgentPlanAnswer, AgentRunStatus } from "@repo/types/agent"
import {
  completeAgentRun,
  getAgentRun,
  getProjectAgentRuns,
  sendAgentChat,
  startAgentPlan,
  startFix,
} from "@/lib/api"

// An agent run is "live" until it reaches a terminal state.
const TERMINAL: AgentRunStatus[] = [
  "PR_OPENED",
  "COMPLETED",
  "FAILED",
  "CANCELED",
]

// Statuses where the backend is actively producing chat content (planning the
// fix, or running it). We poll the detail every 3s while in one of these so the
// chat fills in live; once the plan is posted (AWAITING_INPUT) or the run ends,
// polling stops.
const WORKING: AgentRunStatus[] = [
  "QUEUED",
  "PLANNING",
  "FIXING",
  "VERIFYING",
  "OPENING_PR",
  "CHATTING",
]

export function isAgentRunLive(status?: AgentRunStatus): boolean {
  return !!status && !TERMINAL.includes(status)
}

export function isAgentRunWorking(status?: AgentRunStatus): boolean {
  return !!status && WORKING.includes(status)
}

// All agent runs for a project (newest first). Used to find the latest run and
// to power the "Agent Run" button. Refetches on mount and self-polls while any
// run is actively working, so a newly started/finished run shows without a
// manual page refresh.
export function useProjectAgentRuns(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["agent-runs", projectId],
    queryFn: () => getProjectAgentRuns(projectId),
    enabled: enabled && !!projectId,
    refetchOnMount: "always",
    refetchInterval: (query) =>
      (query.state.data ?? []).some((r) => isAgentRunWorking(r.status))
        ? 4000
        : false,
  })
}

// One run with its plan + checks + chat logs. Polls every 3s while the run is
// actively working so the chat streams in.
export function useAgentRun(agentRunId: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-run", agentRunId],
    queryFn: () => getAgentRun(agentRunId as string),
    enabled: !!agentRunId,
    refetchInterval: (query) =>
      isAgentRunWorking(query.state.data?.status) ? 3000 : false,
  })
}

// Kick off planning for a project's latest scan.
export function useStartAgentPlan(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) => startAgentPlan(projectId, { orderId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-runs", projectId] })
      qc.invalidateQueries({ queryKey: ["worker-status"] })
    },
  })
}

// Submit the plan answers and start the fix run.
export function useStartFix(agentRunId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (answers: AgentPlanAnswer[]) => startFix(agentRunId, answers),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-run", agentRunId] })
      qc.invalidateQueries({ queryKey: ["worker-status"] })
    },
  })
}

// Send a post-PR chat message.
export function useSendChat(agentRunId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (message: string) => sendAgentChat(agentRunId, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-run", agentRunId] })
    },
  })
}

// Mark a run complete (so a new run can be started for the project).
export function useCompleteRun(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (agentRunId: string) => completeAgentRun(agentRunId),
    onSuccess: (_data, agentRunId) => {
      qc.invalidateQueries({ queryKey: ["agent-runs", projectId] })
      qc.invalidateQueries({ queryKey: ["agent-run", agentRunId] })
    },
  })
}
