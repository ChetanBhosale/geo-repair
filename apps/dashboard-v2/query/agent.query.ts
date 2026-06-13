"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AgentChatLog,
  AgentPlanAnswer,
  AgentRunDetail,
  AgentRunStatus,
} from "@repo/types/agent"
import {
  getAgentRun,
  getProjectAgentRunBySlug,
  getProjectAgentRuns,
  revalidateAgentRun,
  sendAgentChat,
  startAgentPlan,
  startFix,
} from "@/lib/api"

// An agent thread is "live" until it fails or is canceled. PR state only routes
// the next chat turn.
const TERMINAL: AgentRunStatus[] = ["FAILED", "CANCELED"]

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

// All agent threads for a project (newest first). Used to find the active
// thread and power the agent button. Refetches on mount and self-polls while any
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
    refetchIntervalInBackground: true,
  })
}

export function useProjectAgentRunBySlug(
  projectId: string,
  slug: string | null | undefined
) {
  return useQuery({
    queryKey: ["agent-run", projectId, "slug", slug],
    queryFn: () => getProjectAgentRunBySlug(projectId, slug as string),
    enabled: !!projectId && !!slug,
    refetchInterval: (query) =>
      isAgentRunWorking(query.state.data?.status) ? 3000 : false,
    refetchIntervalInBackground: true,
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
    onMutate: async (message) => {
      const queryKey = ["agent-run", agentRunId] as const
      await qc.cancelQueries({ queryKey })
      const previous = qc.getQueryData<AgentRunDetail>(queryKey)

      if (previous) {
        const nextSeq =
          previous.logs.reduce((max, log) => Math.max(max, log.seq), -1) + 1
        const optimisticLog: AgentChatLog = {
          id: `optimistic-${Date.now()}`,
          source: "USER",
          level: "info",
          event: "user_message",
          message,
          planId: null,
          data: null,
          seq: nextSeq,
          createdAt: new Date().toISOString(),
        }

        qc.setQueryData<AgentRunDetail>(queryKey, {
          ...previous,
          status: "CHATTING",
          logs: [...previous.logs, optimisticLog],
        })
      }

      return { previous }
    },
    onError: (_error, _message, context) => {
      if (context?.previous) {
        qc.setQueryData(["agent-run", agentRunId], context.previous)
      }
      qc.invalidateQueries({ queryKey: ["agent-run", agentRunId] })
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["agent-run", agentRunId] })
      qc.invalidateQueries({ queryKey: ["billing-history"] })
    },
  })
}

// Internal preset chat turn for repair validation. Hidden from the main UI and
// charged against the same follow-up AI credit balance when called.
export function useRevalidateAgentRun(agentRunId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => revalidateAgentRun(agentRunId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-run", agentRunId] })
      qc.invalidateQueries({ queryKey: ["worker-status"] })
      qc.invalidateQueries({ queryKey: ["billing-history"] })
    },
  })
}
