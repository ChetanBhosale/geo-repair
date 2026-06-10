"use client"

import * as React from "react"
import type {
  AgentChatLog,
  AgentPlanCheckDTO,
  AgentPlanDTO,
  AgentRunDetail,
} from "@repo/types/agent"

import { isAgentRunLive, useAgentRun } from "@/query/agent.query"

interface AgentContextValue {
  agentRunId: string
  run: AgentRunDetail | null
  plan: AgentPlanDTO | null
  checks: AgentPlanCheckDTO[]
  logs: AgentChatLog[]
  // chat = AGENT logs (minus the plan card); code = AGENT_FILE logs.
  chatLogs: AgentChatLog[]
  fileLogs: AgentChatLog[]
  planLog: AgentChatLog | null
  isLoading: boolean
  isLive: boolean
}

const AgentContext = React.createContext<AgentContextValue | null>(null)

export function AgentProvider({
  agentRunId,
  children,
}: {
  agentRunId: string
  children: React.ReactNode
}) {
  const query = useAgentRun(agentRunId)
  const run = query.data ?? null
  const plan = run?.plan ?? null
  const checks = React.useMemo(() => plan?.checks ?? [], [plan])
  const logs = React.useMemo(() => run?.logs ?? [], [run])

  const chatLogs = React.useMemo(
    () => logs.filter((l) => l.source === "AGENT" && !l.planId),
    [logs]
  )
  const fileLogs = React.useMemo(
    () => logs.filter((l) => l.source === "AGENT_FILE"),
    [logs]
  )
  const planLog = React.useMemo(() => logs.find((l) => l.planId) ?? null, [logs])

  const value = React.useMemo<AgentContextValue>(
    () => ({
      agentRunId,
      run,
      plan,
      checks,
      logs,
      chatLogs,
      fileLogs,
      planLog,
      isLoading: query.isLoading,
      isLive: isAgentRunLive(run?.status),
    }),
    [agentRunId, run, plan, checks, logs, chatLogs, fileLogs, planLog, query.isLoading]
  )

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>
}

export function useAgent() {
  const ctx = React.useContext(AgentContext)
  if (!ctx) throw new Error("useAgent must be used within an AgentProvider")
  return ctx
}
