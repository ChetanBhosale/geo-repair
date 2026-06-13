"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  GitPullRequestIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  PlusIcon,
  RobotIcon,
  SpinnerGapIcon,
  TerminalIcon,
  WarningIcon,
} from "@phosphor-icons/react"
import type {
  AgentChatLog,
  AgentPlanAnswer,
  AgentPlanCheckDTO,
  AgentRunDetail,
  AgentRunStatus,
} from "@repo/types/agent"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { useBreadcrumbs } from "@/context/breadcrumb"
import { AgentProvider, useAgent } from "@/context/agent"
import { useSendChat, useStartFix } from "@/query/agent.query"
import { Markdown } from "@/components/markdown"

type Mode = "AUTO" | "NEEDS_INPUT"
type PreviewKey = "plan" | "checks" | "changes"

type ThreadItem =
  | { type: "agent"; logs: AgentChatLog[] }
  | { type: "user"; logs: AgentChatLog[] }
  | { type: "plan"; log: AgentChatLog }

type AgentActivityRow =
  | { type: "activity"; logs: AgentChatLog[] }
  | { type: "message"; log: AgentChatLog }

type ActivityKind =
  | "search"
  | "list"
  | "read"
  | "edit"
  | "create"
  | "validate"
  | "validation_failed"
  | "build"
  | "test"
  | "lint"
  | "typecheck"
  | "install"
  | "serve"
  | "url"
  | "git"
  | "clone"
  | "setup"
  | "pr"
  | "decision"
  | "command"
  | "command_failed"
  | "output"
  | "failed"

type ActivityMeta = {
  singular: string
  plural: string
  order: number
}

type ActivityAction = {
  kind: ActivityKind
  target?: string | null
}

type ActivityGroup = {
  count: number
  targets: Set<string>
}

const RUN_BADGE: Record<AgentRunStatus, string> = {
  QUEUED: "bg-muted text-foreground/70",
  PLANNING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  AWAITING_INPUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  FIXING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  VERIFYING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  OPENING_PR: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PR_OPENED: "bg-primary/10 text-primary",
  CHATTING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  COMPLETED: "bg-primary/10 text-primary",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELED: "bg-muted text-foreground/70",
}

const AGENT_WORKING_STATUSES: AgentRunStatus[] = [
  "QUEUED",
  "PLANNING",
  "FIXING",
  "VERIFYING",
  "OPENING_PR",
  "CHATTING",
]

function isAgentWorking(status: AgentRunStatus): boolean {
  return AGENT_WORKING_STATUSES.includes(status)
}

function agentStatusLabel(status: AgentRunStatus): string {
  if (status === "AWAITING_INPUT") return "needs input"
  if (status === "FAILED") return "failed"
  if (status === "CANCELED") return "canceled"
  if (status === "QUEUED" || status === "PLANNING") return "planning"
  if (isAgentWorking(status)) return "working"
  return "ready"
}

function isActivityLog(log: AgentChatLog): boolean {
  if (log.source === "USER") return false
  if (log.source === "AGENT_FILE") return true
  return log.event !== "agent_message"
}

function threadItemKey(item: ThreadItem): string {
  if (item.type === "plan") return `plan-${item.log.id}`
  const first = item.logs[0]?.id ?? "empty"
  const last = item.logs.at(-1)?.id ?? first
  return `${item.type}-${first}-${last}`
}

function buildThreadItems(logs: AgentChatLog[]): ThreadItem[] {
  const items: ThreadItem[] = []
  const latestPlanPromptId = logs.filter((log) => log.planId).at(-1)?.id

  for (const log of logs) {
    if (log.planId) {
      if (log.id === latestPlanPromptId) items.push({ type: "plan", log })
      continue
    }

    const type = log.source === "USER" ? "user" : "agent"
    const last = items.at(-1)
    if (last?.type === type) last.logs.push(log)
    else items.push({ type, logs: [log] })
  }

  return items
}

function scoreProgressText(run: AgentRunDetail): string {
  const before = run.scoreBefore ?? "--"
  if (run.scoreAfter != null) return `${before} -> ${run.scoreAfter}`
  if (isAgentWorking(run.status) || run.status === "AWAITING_INPUT") {
    return `${before} -> working toward 100`
  }
  return `${before} -> --`
}

function checkProgressText(checks: AgentPlanCheckDTO[]): string {
  const done = checks.filter((check) =>
    ["FIXED", "SKIPPED_BY_USER", "FLAGGED_MANUAL", "ALREADY_OK"].includes(
      check.outcome
    )
  ).length
  return `${done}/${checks.length}`
}

export default function AgentRunPage() {
  const params = useParams<{ projectId: string; agentId: string }>()
  return (
    <AgentProvider agentRunId={params.agentId}>
      <AgentScreen />
    </AgentProvider>
  )
}

function AgentScreen() {
  const params = useParams<{ projectId: string; agentId: string }>()
  const { run, plan, checks, logs, fileLogs, isLoading } = useAgent()
  const threadItems = React.useMemo(() => buildThreadItems(logs), [logs])
  const [activePreview, setActivePreview] = React.useState<PreviewKey | null>(
    null
  )

  // Auto-scroll the chat to the bottom as new logs stream in.
  const scrollRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs.length, run?.status])

  useBreadcrumbs([
    { label: "Projects", href: "/dashboard/projects" },
    { label: "Project", href: `/dashboard/projects/${params.projectId}` },
    { label: "Agent run" },
  ])

  if (isLoading && !run) {
    return (
      <div className="px-6 py-6">
        <DashboardInlineLoading rows={2} />
      </div>
    )
  }
  if (!run) {
    return (
      <div className="grid h-[calc(100svh-3.5rem)] place-items-center px-6 text-center text-sm text-foreground/70">
        This agent run could not be found.
      </div>
    )
  }

  const planning = run.status === "QUEUED" || run.status === "PLANNING"
  const failed = run.status === "FAILED"
  const needsInput =
    run.status === "AWAITING_INPUT"
      ? checks.filter((c) => c.mode === "NEEDS_INPUT" && c.choice === "PENDING")
      : checks.filter((c) => c.mode === "NEEDS_INPUT")
  const autoCount = checks.filter((c) => c.mode === "AUTO").length
  const manualCount = plan?.manual.length ?? 0
  // Locked once the plan has been submitted (anything past awaiting input).
  const locked = run.status !== "AWAITING_INPUT"
  const planSummary = plan?.summary ?? ""
  const hasPlanArtifact = planSummary.length > 0
  // While the user is approving the plan, hide Checks because it mostly
  // duplicates the plan. Checks becomes useful again after execution starts.
  const showChecksTab = !(run.status === "AWAITING_INPUT" && hasPlanArtifact)
  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-col overflow-hidden bg-background">
      <AgentRunHeader run={run} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative min-w-0 flex-1">
          <AgentFloatingToolbar
            run={run}
            checks={checks}
            activePreview={activePreview}
            hasPlanArtifact={hasPlanArtifact}
            showChecks={showChecksTab}
            onPreview={setActivePreview}
          />

          {/* CENTER CHAT: primary surface. Adjust max-w-3xl to change the focused chat width. */}
          <div className="flex h-full w-full flex-col pt-4">
            {/* Conversation scroller spans the whole pane, so wheel/trackpad
                scrolling works even outside the centered chat column. */}
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto"
            >
              <div className="mx-auto w-full max-w-3xl space-y-3 py-5 pr-8 pl-6">
                {/* All logs in order; plan cards split groups, while commands and
                    tool calls render as flat activity rows inside the agent group. */}
                {threadItems.map((item) =>
                  item.type === "plan" ? (
                    hasPlanArtifact && plan ? (
                      <PlanConversationPrompt
                        key={threadItemKey(item)}
                        runId={run.id}
                        status={run.status}
                        locked={locked}
                        checksCount={checks.length}
                        needsInputCount={needsInput.length}
                        needsInput={needsInput}
                        followup={plan.status === "SUBMITTED"}
                        onOpen={() => setActivePreview("plan")}
                      />
                    ) : null
                  ) : item.type === "agent" ? (
                    <AgentActivityGroup
                      key={threadItemKey(item)}
                      logs={item.logs}
                    />
                  ) : (
                    <UserMessageGroup
                      key={threadItemKey(item)}
                      logs={item.logs}
                    />
                  )
                )}

                {isAgentWorking(run.status) ? (
                  <AgentWorkingIndicator status={run.status} />
                ) : null}

                {failed ? (
                  <FailedRunMessage run={run} projectId={params.projectId} />
                ) : null}
              </div>
            </div>

            <div className="mx-auto w-full max-w-3xl px-5">
              <Composer run={run} />
            </div>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {activePreview ? (
            <AgentPreviewPanel
              activePreview={activePreview}
              run={run}
              plan={plan}
              checks={checks}
              fileLogs={fileLogs}
              planning={planning}
              failed={failed}
              projectId={params.projectId}
              planSummary={planSummary}
              autoCount={autoCount}
              manualCount={manualCount}
              needsInputCount={needsInput.length}
              onClose={() => setActivePreview(null)}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}

function AgentRunHeader({ run }: { run: AgentRunDetail }) {
  return (
    // Full-width run header. Keep it outside the centered chat and contextual
    // preview so it spans the whole agent page edge to edge.
    <div className="flex shrink-0 items-center justify-between gap-3 bg-secondary px-5 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="grid size-7 place-items-center rounded-lg bg-accent text-accent-foreground">
          <RobotIcon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm leading-tight font-medium">Fix agent</p>
          <p className="truncate font-mono text-[11px] text-foreground/65">
            {run.id}
          </p>
        </div>
      </div>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-medium",
          RUN_BADGE[run.status]
        )}
      >
        {agentStatusLabel(run.status)}
      </span>
    </div>
  )
}

// --- floating context controls ---------------------------------------------

function AgentFloatingToolbar({
  run,
  checks,
  activePreview,
  hasPlanArtifact,
  showChecks,
  onPreview,
}: {
  run: AgentRunDetail
  checks: AgentPlanCheckDTO[]
  activePreview: PreviewKey | null
  hasPlanArtifact: boolean
  showChecks: boolean
  onPreview: (preview: PreviewKey) => void
}) {
  return (
    // Floating toolbar: keep contextual controls here so the chat stays centered.
    <div className="pointer-events-none absolute top-4 right-4 z-30 flex max-w-[calc(100%-2rem)] justify-end">
      <div className="pointer-events-auto flex w-40 flex-col gap-1.5 rounded-md bg-secondary p-2">
        <span
          className={cn(
            "w-full rounded-lg px-2 text-center text-[11px] font-medium"
          )}
        >
          Score to aim
        </span>
        <span className="w-full rounded-none px-2 pb-1.5 text-center text-[11px] font-medium text-foreground/75">
          {scoreProgressText(run)}
        </span>
        <span className="w-full rounded-none px-2 pb-1.5 text-center text-[11px] font-medium text-foreground/75">
          Checks {checkProgressText(checks)}
        </span>

        {hasPlanArtifact ? (
          <ToolbarButton
            active={activePreview === "plan"}
            onClick={() => onPreview("plan")}
          >
            <RobotIcon className="size-3.5" />
            Plan
          </ToolbarButton>
        ) : null}
        {showChecks ? (
          <ToolbarButton
            active={activePreview === "checks"}
            onClick={() => onPreview("checks")}
          >
            <CheckCircleIcon className="size-3.5" />
            Checks
          </ToolbarButton>
        ) : null}
        <ToolbarButton
          active={activePreview === "changes"}
          onClick={() => onPreview("changes")}
        >
          <PencilSimpleIcon className="size-3.5" />
          Changes
        </ToolbarButton>

        {run.prUrl ? (
          <Button
            size="sm"
            variant="secondary"
            className="w-full justify-start bg-background"
            asChild
          >
            <a href={run.prUrl} target="_blank" rel="noreferrer">
              <GitPullRequestIcon className="size-3.5" />
              View PR
            </a>
          </Button>
        ) : (
          <Button
            size="sm"
            disabled
            className="w-full justify-start bg-background text-foreground/55"
          >
            <GitPullRequestIcon className="size-3.5" />
            View PR
          </Button>
        )}
      </div>
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={onClick}
      className={cn(
        "w-full justify-start bg-background",
        active && "bg-primary text-primary-foreground hover:bg-primary/80"
      )}
    >
      {children}
    </Button>
  )
}

function AgentPreviewPanel({
  activePreview,
  run,
  plan,
  checks,
  fileLogs,
  planning,
  failed,
  projectId,
  planSummary,
  autoCount,
  manualCount,
  needsInputCount,
  onClose,
}: {
  activePreview: PreviewKey
  run: AgentRunDetail
  plan: AgentRunDetail["plan"]
  checks: AgentPlanCheckDTO[]
  fileLogs: AgentChatLog[]
  planning: boolean
  failed: boolean
  projectId: string
  planSummary: string
  autoCount: number
  manualCount: number
  needsInputCount: number
  onClose: () => void
}) {
  const reduceMotion = useReducedMotion()
  const title: Record<PreviewKey, string> = {
    plan: "Plan",
    checks: "Checks",
    changes: "Changes",
  }

  return (
    // Context preview: real flex item, not an overlay. Opening it consumes
    // horizontal space, so the chat and floating toolbar both shift left.
    // The outer shell animates width; the inner panel keeps the readable width.
    <motion.aside
      initial={reduceMotion ? false : { opacity: 0, width: 0, x: 32 }}
      animate={
        reduceMotion
          ? { opacity: 1, width: "min(440px, calc(100vw - 2rem))" }
          : { opacity: 1, width: "min(440px, calc(100vw - 2rem))", x: 0 }
      }
      exit={
        reduceMotion
          ? { opacity: 0, width: 0 }
          : { opacity: 0, width: 0, x: 32 }
      }
      transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.8 }}
      className="relative z-20 my-4 mr-4 min-h-0 shrink-0 overflow-hidden"
    >
      <div className="flex h-full w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl bg-secondary">
        <div className="flex items-center justify-between gap-3 bg-muted px-4 py-3">
          <div>
            <h2 className="text-sm font-medium">{title[activePreview]}</h2>
            <p className="mt-0.5 text-[11px] text-foreground/65">
              {scoreProgressText(run)} · {agentStatusLabel(run.status)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close preview"
            onClick={onClose}
            className="grid size-7 cursor-pointer place-items-center rounded-lg bg-background text-sm text-foreground/70 hover:text-foreground"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {activePreview === "plan" ? (
            plan && planSummary ? (
              <PlanArtifact
                summary={planSummary}
                checks={checks}
                manual={plan.manual}
                autoCount={autoCount}
                manualCount={manualCount}
                needsInputCount={needsInputCount}
              />
            ) : (
              <Empty text="No plan yet." />
            )
          ) : activePreview === "checks" ? (
            <ChecksPreview
              run={run}
              checks={checks}
              manual={plan?.manual ?? []}
              planning={planning}
              failed={failed}
              projectId={projectId}
            />
          ) : (
            <ChangesView checks={checks} fileLogs={fileLogs} />
          )}
        </div>
      </div>
    </motion.aside>
  )
}

function ChecksPreview({
  run,
  checks,
  manual,
  planning,
  failed,
  projectId,
}: {
  run: AgentRunDetail
  checks: AgentPlanCheckDTO[]
  manual: { rubricId: string; reason: string }[]
  planning: boolean
  failed: boolean
  projectId: string
}) {
  if (checks.length === 0) {
    return failed ? (
      <FailedRunPanel run={run} projectId={projectId} />
    ) : (
      <Empty
        text={planning ? "Planning in progress..." : "No checks planned."}
      />
    )
  }

  return (
    <div className="space-y-2">
      {checks.map((c) => (
        <CheckCard key={c.id} check={c} />
      ))}
      {manual.map((m) => (
        <ManualCard key={m.rubricId} rubricId={m.rubricId} reason={m.reason} />
      ))}
    </div>
  )
}

// --- chat primitives --------------------------------------------------------

function ChatBubble({
  level = "info",
  children,
}: {
  event: string
  level?: "info" | "warn" | "error"
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "text-sm leading-6 text-foreground",
        level === "error" && "text-destructive",
        level === "warn" && "text-warning"
      )}
    >
      {children}
    </div>
  )
}

function FailedRunActions({
  projectId,
  align = "start",
}: {
  projectId: string
  align?: "start" | "center"
}) {
  const router = useRouter()
  const projectHref = `/dashboard/projects/${projectId}`

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2",
        align === "center" && "justify-center"
      )}
    >
      <Button
        size="sm"
        variant="outline"
        onClick={() => router.push(projectHref)}
      >
        <ArrowLeftIcon className="size-3.5" />
        Back to project
      </Button>
    </div>
  )
}

function FailedRunMessage({
  run,
  projectId,
}: {
  run: AgentRunDetail
  projectId: string
}) {
  return (
    <ChatBubble event="next_step" level="warn">
      <div className="space-y-3">
        <div>
          <p className="font-medium text-foreground">Fix did not start</p>
          <p className="mt-0.5 text-foreground/75">
            {run.orderId
              ? "Nothing was changed in your repo. Return to the project or contact support."
              : "Go back to the project and start again from the latest scan."}
          </p>
        </div>
        <FailedRunActions projectId={projectId} />
      </div>
    </ChatBubble>
  )
}

function FailedRunPanel({
  run,
  projectId,
}: {
  run: AgentRunDetail
  projectId: string
}) {
  return (
    <div className="grid min-h-48 place-items-center rounded-xl bg-muted/60 px-6 py-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid size-9 place-items-center rounded-lg bg-destructive/10 text-destructive">
          <WarningIcon className="size-5" />
        </div>
        <h2 className="mt-3 text-sm font-medium">Fix did not start</h2>
        <p className="mt-1 text-xs leading-relaxed text-foreground/75">
          {run.orderId
            ? "Nothing was changed in your repo. Return to the project or contact support."
            : "Nothing was changed in your repo. Return to the project to start again."}
        </p>
        <div className="mt-4">
          <FailedRunActions projectId={projectId} align="center" />
        </div>
      </div>
    </div>
  )
}

function AgentWorkingIndicator({ status }: { status: AgentRunStatus }) {
  const label: Record<string, string> = {
    QUEUED: "Agent is starting...",
    PLANNING: "Agent is planning...",
    FIXING: "Agent is working...",
    VERIFYING: "Agent is verifying...",
    OPENING_PR: "Agent is preparing your fix...",
    CHATTING: "Agent is working...",
  }

  return (
    // Bottom-of-thread live indicator. Only render for active agent states;
    // hide it when the user needs to answer, or when the run is blocked/done.
    <div className="flex items-center gap-2 py-1 text-sm text-foreground/70">
      <SpinnerGapIcon className="size-3.5 animate-spin" />
      <span>{label[status] ?? "Agent is working..."}</span>
    </div>
  )
}

function PlanConversationPrompt({
  runId,
  status,
  locked,
  checksCount,
  needsInputCount,
  needsInput,
  followup,
  onOpen,
}: {
  runId: string
  status: AgentRunStatus
  locked: boolean
  checksCount: number
  needsInputCount: number
  needsInput: AgentPlanCheckDTO[]
  followup: boolean
  onOpen: () => void
}) {
  const startFix = useStartFix(runId)

  // Seed answers from the stored choices so a submitted plan shows the picks.
  const [answers, setAnswers] = React.useState<
    Record<string, { selectedOption: string | null; note: string }>
  >(() =>
    Object.fromEntries(
      needsInput.map((c) => [
        c.rubricId,
        { selectedOption: c.selectedOption, note: c.userSuggestion ?? "" },
      ])
    )
  )

  const answeredCount = needsInput.filter(
    (c) => answers[c.rubricId]?.selectedOption
  ).length
  // Validation: every question must be answered to enable submit.
  const allAnswered =
    needsInput.length === 0 || answeredCount === needsInput.length
  const disabled = locked || startFix.isPending || !allAnswered

  function pick(rubricId: string, optionId: string) {
    if (locked) return
    setAnswers((p) => ({
      ...p,
      [rubricId]: { selectedOption: optionId, note: p[rubricId]?.note ?? "" },
    }))
  }
  function setNote(rubricId: string, note: string) {
    if (locked) return
    setAnswers((p) => ({
      ...p,
      [rubricId]: { selectedOption: p[rubricId]?.selectedOption ?? null, note },
    }))
  }

  async function onSubmit() {
    const payload: AgentPlanAnswer[] = needsInput.map((c) => {
      const a = answers[c.rubricId]
      const selected = a?.selectedOption ?? null
      return {
        rubricId: c.rubricId,
        choice:
          selected === "no" || selected === "skip" ? "DECLINED" : "APPROVED",
        selectedOption: selected,
        userSuggestion: a?.note || null,
      }
    })
    try {
      await startFix.mutateAsync(payload)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start the fix run."
      )
    }
  }

  return (
    // Chat-side approval card. Keep the actual questions here so the user
    // answers in the conversation, while the full plan preview lives on the right.
    <div className="space-y-3 rounded-lg bg-secondary px-3 py-3 text-foreground">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            {followup ? "Input needed" : "Fix plan ready"}
          </p>
          <p className="mt-0.5 text-xs text-foreground/75">
            {followup
              ? "Some checks need a decision before PR."
              : "Open the plan on the right to review before starting."}
          </p>
          <div className="mt-2 flex gap-2 text-[11px] text-foreground/65">
            <span>{checksCount} checks</span>
            <span>
              {needsInputCount} {followup ? "unresolved" : "need input"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 cursor-pointer text-xs font-medium text-primary hover:text-primary/80"
        >
          View plan
        </button>
      </div>

      {needsInput.length > 0 ? (
        <div className="space-y-3">
          {/* Individual question cards. bg-background intentionally contrasts
              against the outer bg-secondary card. */}
          {needsInput.map((c) => (
            <div
              key={c.id}
              className="space-y-2 rounded-lg bg-background px-3 py-3"
            >
              <div>
                <p className="font-mono text-xs font-semibold">{c.rubricId}</p>
                {c.question ? (
                  <p className="mt-1 text-sm leading-5 text-foreground">
                    {c.question}
                  </p>
                ) : null}
              </div>
              {c.options ? (
                <div className="space-y-1.5">
                  {c.options.map((opt) => {
                    const active =
                      answers[c.rubricId]?.selectedOption === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={locked}
                        onClick={() => pick(c.rubricId, opt.id)}
                        className={cn(
                          // Option rows need visible contrast in both selected
                          // and unselected states; rings are the main affordance.
                          "w-full cursor-pointer rounded-md bg-secondary px-3 py-2 text-left text-xs text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                          active
                            ? "bg-primary/10 text-primary ring-2 ring-primary/50"
                            : "ring-1 ring-foreground/15 hover:bg-muted"
                        )}
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          {/* Custom radio indicator. The unselected ring must stay
                              visible on gray backgrounds. */}
                          <span
                            className={cn(
                              "grid size-3.5 place-items-center rounded-full bg-background ring-2 ring-foreground/45",
                              active && "bg-primary ring-primary"
                            )}
                          >
                            {active ? (
                              <span className="size-1.5 rounded-full bg-primary-foreground" />
                            ) : null}
                          </span>
                          {opt.label}
                        </span>
                        {opt.description ? (
                          <span className="mt-1 block pl-5 text-[11px] leading-4 text-foreground/75">
                            {opt.description}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ) : null}
              <Textarea
                value={answers[c.rubricId]?.note ?? ""}
                disabled={locked}
                onChange={(e) => setNote(c.rubricId, e.target.value)}
                placeholder="Add a note for the agent (optional)"
                // Keep the note field visually separate from the option rows.
                className="min-h-9 bg-background text-foreground ring-1 ring-foreground/20 placeholder:text-foreground/60 focus-visible:ring-primary/50"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-background px-3 py-2 text-sm text-foreground">
          {followup
            ? "No unresolved checks need input."
            : "Review the plan, then confirm to start the fix."}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-foreground/65">
          {answeredCount}/{needsInput.length} answered
        </span>
        {locked ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <CheckCircleIcon className="size-4" weight="fill" />
            {status === "FAILED" ? "Submitted" : "Submitted, fixing..."}
          </span>
        ) : (
          <Button size="sm" disabled={disabled} onClick={onSubmit}>
            {startFix.isPending ? (
              <SpinnerGapIcon className="size-3.5 animate-spin" />
            ) : (
              <PaperPlaneTiltIcon className="size-3.5" />
            )}
            {followup ? "Submit decisions" : "Submit plan"}
          </Button>
        )}
      </div>
    </div>
  )
}

function PlanArtifact({
  summary,
  checks,
  needsInputCount,
  autoCount,
  manualCount,
  manual,
}: {
  summary: string
  checks: AgentPlanCheckDTO[]
  needsInputCount: number
  autoCount: number
  manualCount: number
  manual: { rubricId: string; reason: string }[]
}) {
  return (
    // Right-side read-only plan preview. Do not put user inputs here; the
    // approval controls stay in PlanConversationPrompt in the chat thread.
    <div className="space-y-5 text-xs">
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Fix plan</h2>
        <p className="text-sm leading-6 text-foreground/90">{summary}</p>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Pill className="bg-primary/10 text-primary">
            {autoCount} auto-fix
          </Pill>
          <Pill className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
            {needsInputCount} need you
          </Pill>
          <Pill className="bg-muted text-foreground/70">
            {manualCount} manual
          </Pill>
        </div>
      </div>

      <ol className="space-y-4">
        {checks.map((c, i) => (
          <li key={c.id} className="rounded-lg bg-muted/50 px-3 py-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-semibold text-foreground/70">
                {i + 1}.
              </span>
              <span className="font-mono text-xs font-semibold">
                {c.rubricId}
              </span>
              <ModeTag mode={c.mode} />
            </div>
            {c.approach ? (
              <p className="mt-1 pl-4 text-xs leading-relaxed text-foreground/80">
                {c.approach}
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      {manual.length > 0 ? (
        <div className="rounded-lg bg-muted/50 px-3 py-3">
          <p className="text-[11px] font-medium text-foreground/70">
            Manual review
          </p>
          {manual.map((m) => (
            <p key={m.rubricId} className="mt-1 text-xs text-foreground/75">
              <span className="font-mono">{m.rubricId}</span> {m.reason}
            </p>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-foreground/65">
        Answer in the conversation to start the fix.
      </p>
    </div>
  )
}

function ModeTag({ mode }: { mode: Mode | "MANUAL" }) {
  const map: Record<string, string> = {
    AUTO: "bg-primary/10 text-primary",
    NEEDS_INPUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    MANUAL: "bg-muted text-foreground/70",
  }
  const label: Record<string, string> = {
    AUTO: "auto-fix",
    NEEDS_INPUT: "needs you",
    MANUAL: "manual",
  }
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        map[mode]
      )}
    >
      {label[mode]}
    </span>
  )
}

function Pill({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 font-medium", className)}>
      {children}
    </span>
  )
}

// --- right preview pieces ---------------------------------------------------

function CheckCard({ check }: { check: AgentPlanCheckDTO }) {
  const outcomeLabel =
    check.outcome === "PENDING"
      ? null
      : check.outcome.replace(/_/g, " ").toLowerCase()
  const outcomeClass =
    check.outcome === "FIXED"
      ? "bg-primary/10 text-primary"
      : check.outcome === "FAILED"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-foreground/70"
  const iconClass =
    check.outcome === "FAILED" ? "text-destructive" : "text-primary"

  return (
    // Compact post-submit status row. Keep detailed page/file data in ChangesView.
    <div className="rounded-lg bg-muted/50 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <CheckCircleIcon
            className={cn("mt-0.5 size-4 shrink-0", iconClass)}
          />
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-medium">
              {check.rubricId}
            </p>
            {check.approach ? (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-foreground/75">
                {check.approach}
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0">
          {outcomeLabel ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                outcomeClass
              )}
            >
              {outcomeLabel}
            </span>
          ) : (
            <ModeTag mode={check.mode} />
          )}
        </div>
      </div>
    </div>
  )
}

function ManualCard({
  rubricId,
  reason,
}: {
  rubricId: string
  reason: string
}) {
  return (
    // Manual items mirror CheckCard so the Checks tab stays scannable.
    <div className="rounded-lg bg-muted/50 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <WarningIcon className="mt-0.5 size-4 shrink-0 text-foreground/70" />
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-medium">{rubricId}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-foreground/75">
              {reason}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <ModeTag mode="MANUAL" />
        </div>
      </div>
    </div>
  )
}

// Actual file changes from the fix run (AGENT_FILE `file_change` logs). Falls
// back to the planned target pages before the fix runs.
function ChangesView({
  checks,
  fileLogs,
}: {
  checks: AgentPlanCheckDTO[]
  fileLogs: AgentChatLog[]
}) {
  const changes = fileLogs.filter((l) => l.event === "file_change")

  if (changes.length > 0) {
    return (
      <div className="space-y-px overflow-hidden rounded-xl bg-background">
        {changes.map((l, i) => {
          const d = (l.data ?? {}) as {
            path?: string
            action?: string
            rubricId?: string
          }
          return (
            <div
              key={l.id}
              className={cn(
                "flex items-start gap-3 bg-background px-4 py-3",
                i > 0 && "mt-px"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md",
                  d.action === "create"
                    ? "bg-primary/10 text-primary"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}
              >
                {d.action === "create" ? (
                  <PlusIcon className="size-3.5" />
                ) : (
                  <PencilSimpleIcon className="size-3.5" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-medium">
                  {d.path ?? l.message}
                </p>
                {d.rubricId ? (
                  <span className="mt-0.5 inline-block font-mono text-[10px] text-foreground/70">
                    {d.rubricId}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Pre-fix: show the planned target pages.
  const planned = checks.flatMap((c) =>
    c.targetPages.map((p) => ({ ...p, rubricId: c.rubricId }))
  )
  if (planned.length === 0) return <Empty text="No file changes yet." />
  return (
    <div className="space-y-px overflow-hidden rounded-xl bg-background">
      {planned.map((f, i) => (
        <div
          key={`${f.rubricId}-${i}`}
          className={cn(
            "flex items-start gap-3 bg-background px-4 py-3",
            i > 0 && "mt-px"
          )}
        >
          <span
            className={cn(
              "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md",
              f.action === "create"
                ? "bg-primary/10 text-primary"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}
          >
            {f.action === "create" ? (
              <PlusIcon className="size-3.5" />
            ) : (
              <PencilSimpleIcon className="size-3.5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-xs font-medium">{f.url}</p>
            <p className="mt-0.5 text-xs text-foreground/75">{f.reason}</p>
            <span className="mt-1 inline-block font-mono text-[10px] text-foreground/70">
              {f.rubricId}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function displayMessage(log: AgentChatLog): string {
  if (log.event === "workflow_reconcile_failed") {
    return "The fix stopped before it could finish."
  }
  return log.message
}

function displayLevel(log: AgentChatLog): "info" | "warn" | "error" {
  if (log.event === "verify_failed") return "warn"
  if (log.level === "debug") return "info"
  return log.level
}

const ACTIVITY_META: Record<ActivityKind, ActivityMeta> = {
  search: { singular: "searched code", plural: "searched code", order: 10 },
  list: { singular: "listed files", plural: "listed files", order: 20 },
  read: { singular: "read a file", plural: "read files", order: 30 },
  edit: { singular: "edited a file", plural: "edited files", order: 40 },
  create: { singular: "created a file", plural: "created files", order: 50 },
  validate: { singular: "ran validation", plural: "ran validation", order: 60 },
  validation_failed: {
    singular: "validation found an issue",
    plural: "validation found issues",
    order: 61,
  },
  build: { singular: "ran a build", plural: "ran builds", order: 70 },
  test: { singular: "ran tests", plural: "ran tests", order: 80 },
  lint: { singular: "ran lint", plural: "ran lint", order: 90 },
  typecheck: { singular: "checked types", plural: "checked types", order: 100 },
  install: {
    singular: "installed dependencies",
    plural: "installed dependencies",
    order: 110,
  },
  serve: { singular: "started the app", plural: "started the app", order: 120 },
  url: { singular: "checked a URL", plural: "checked URLs", order: 130 },
  git: {
    singular: "checked git state",
    plural: "checked git state",
    order: 140,
  },
  clone: {
    singular: "cloned the repository",
    plural: "cloned the repository",
    order: 150,
  },
  setup: {
    singular: "prepared the workspace",
    plural: "prepared the workspace",
    order: 160,
  },
  pr: {
    singular: "updated the pull request",
    plural: "updated the pull request",
    order: 170,
  },
  decision: {
    singular: "asked for a decision",
    plural: "asked for decisions",
    order: 180,
  },
  command: { singular: "ran a command", plural: "ran commands", order: 190 },
  command_failed: {
    singular: "a command returned an error",
    plural: "commands returned errors",
    order: 191,
  },
  output: {
    singular: "checked command output",
    plural: "checked command output",
    order: 200,
  },
  failed: {
    singular: "the fix stopped before finishing",
    plural: "the fix stopped before finishing",
    order: 210,
  },
}

function buildAgentActivityRows(logs: AgentChatLog[]): AgentActivityRow[] {
  const rows: AgentActivityRow[] = []
  let batch: AgentChatLog[] = []

  function flushBatch() {
    if (batch.length > 0) {
      rows.push({ type: "activity", logs: batch })
      batch = []
    }
  }

  for (const log of logs) {
    if (isActivityLog(log)) {
      batch.push(log)
    } else {
      flushBatch()
      rows.push({ type: "message", log })
    }
  }

  flushBatch()
  return rows
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function activityData(log: AgentChatLog): Record<string, unknown> {
  return isRecord(log.data) ? log.data : {}
}

function cleanActivityTarget(value: string): string {
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^\.\//, "")
}

function compactActivityTarget(value: string): string {
  const clean = cleanActivityTarget(value)
  return clean.length > 64 ? `${clean.slice(0, 61)}...` : clean
}

function displayPathTarget(value: string): string {
  const clean = compactActivityTarget(value)
  if (!clean || clean === ".") return "repo root"
  return clean
}

function quoteActivityTarget(value: string): string {
  return `"${compactActivityTarget(value)}"`
}

function shellWords(command: string): string[] {
  const words: string[] = []
  const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|(\S+)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(command))) {
    words.push(match[1] ?? match[2] ?? match[3] ?? "")
  }

  return words.filter(Boolean)
}

function optionValue(words: string[], names: string[]): string | null {
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i]
    const withEquals = names
      .map((name) => `${name}=`)
      .find((prefix) => word.startsWith(prefix))
    if (withEquals) return word.slice(withEquals.length)

    if (names.includes(word) && words[i + 1]) return words[i + 1]
  }

  return null
}

function firstCommandValue(words: string[], startAt: number): string | null {
  const flagsWithValues = new Set([
    "-A",
    "-B",
    "-C",
    "-e",
    "-f",
    "-g",
    "-m",
    "-t",
    "--after-context",
    "--before-context",
    "--context",
    "--glob",
    "--ignore-file",
    "--max-count",
    "--type",
    "--type-add",
  ])
  let skipNext = false

  for (let i = startAt; i < words.length; i += 1) {
    const word = words[i]
    if (skipNext) {
      skipNext = false
      continue
    }
    if (word === "--") continue
    if (word.startsWith("-")) {
      skipNext =
        flagsWithValues.has(word) || flagsWithValues.has(word.split("=")[0])
      continue
    }
    if (word === ".") continue
    return word
  }

  return null
}

function commandFromLog(log: AgentChatLog): string | null {
  const message = log.message.trim()
  if (message.startsWith("$")) return message.replace(/^\$\s*/, "")

  const data = activityData(log)
  return typeof data.command === "string" ? data.command : null
}

function prefixedTarget(message: string, prefixes: string[]): string | null {
  const prefix = prefixes.find((candidate) =>
    message.toLowerCase().startsWith(`${candidate.toLowerCase()} `)
  )
  if (!prefix) return null

  return cleanActivityTarget(message.slice(prefix.length + 1))
}

function targetFromCommand(command: string, kind: ActivityKind): string | null {
  const words = shellWords(command)
  if (words.length === 0) return null
  const commandName = words[0]
  const second = words[1]

  if (kind === "list") {
    const glob = optionValue(words, ["-g", "--glob"])
    if (glob) return `files matching ${quoteActivityTarget(glob)}`
    return firstCommandValue(words, 1)
  }

  if (kind === "search") {
    const explicitPattern = optionValue(words, ["-e", "--regexp"])
    if (explicitPattern) return explicitPattern

    if (commandName === "find") {
      return optionValue(words, ["-name", "-iname", "-path"]) ?? null
    }
    if (commandName === "fd") return firstCommandValue(words, 1)
    return firstCommandValue(
      words,
      commandName === "git" && second === "grep" ? 2 : 1
    )
  }

  if (kind === "read") {
    for (let i = words.length - 1; i > 0; i -= 1) {
      const word = words[i]
      if (word.startsWith("-")) continue
      if (/^\d+(,\d+)?[a-z]?$/i.test(word)) continue
      if (word === ".") continue
      return word
    }
  }

  if (kind === "url") {
    return words.find((word) => /^https?:\/\//.test(word)) ?? null
  }

  return null
}

function commandFailed(log: AgentChatLog): boolean {
  if (displayLevel(log) === "error") return true
  return /(?:^|\n)exit:\s*(?!0\b)\d+/.test(log.message)
}

function classifyCommand(command: string): ActivityKind {
  const normalized = command.trim().replace(/\s+/g, " ")

  if (/^(rg|grep|git grep|ag|ack)\b/.test(normalized)) {
    return normalized.includes("--files") ? "list" : "search"
  }
  if (/^(find|fd)\b/.test(normalized)) return "search"
  if (/^(ls|tree)\b/.test(normalized)) return "list"
  if (/^(cat|sed|head|tail|nl|less|more)\b/.test(normalized)) return "read"
  if (
    /^git\s+(status|diff|show|log|branch|rev-parse|ls-files)\b/.test(normalized)
  ) {
    return "git"
  }
  if (
    /\b(install|bun install|npm install|pnpm install|yarn install)\b/.test(
      normalized
    )
  ) {
    return "install"
  }
  if (/\b(build|next build)\b/.test(normalized)) return "build"
  if (/\b(test|vitest|jest|playwright test)\b/.test(normalized)) return "test"
  if (/\b(lint|eslint)\b/.test(normalized)) return "lint"
  if (/\b(typecheck|check-types|tsc)\b/.test(normalized)) return "typecheck"
  if (/\b(dev|start|serve)\b/.test(normalized)) return "serve"
  if (/^(curl|wget)\b/.test(normalized)) return "url"

  return "command"
}

function activity(kind: ActivityKind, target?: string | null): ActivityAction {
  return { kind, target: target ? cleanActivityTarget(target) : null }
}

function activityActionsForLog(log: AgentChatLog): ActivityAction[] {
  const event = log.event.toLowerCase()
  const message = log.message.trim()
  const data = activityData(log)

  if (event === "workflow_reconcile_failed") return [activity("failed")]
  if (event === "fix_decision_prompt") return [activity("decision")]
  if (event === "command_result") {
    return [activity(commandFailed(log) ? "command_failed" : "output")]
  }
  if (event === "file_change") {
    const target =
      typeof data.path === "string"
        ? data.path
        : prefixedTarget(message, ["Edited", "Created", "Generated image"])
    return [activity(data.action === "create" ? "create" : "edit", target)]
  }

  const readTarget = prefixedTarget(message, ["Reading"])
  if (event === "read" || readTarget) {
    return [activity("read", readTarget)]
  }

  const listTarget = prefixedTarget(message, ["Listing"])
  if (listTarget) {
    return [activity("list", listTarget)]
  }

  if (event.includes("pr_") || message.toLowerCase().includes("pull request")) {
    return [activity("pr")]
  }
  if (event.includes("clone") || message.toLowerCase().includes("cloning")) {
    return [activity("clone")]
  }
  if (event.includes("sandbox")) return [activity("setup")]
  if (
    event.includes("verify") ||
    event.includes("validation") ||
    event.includes("rescan")
  ) {
    return [
      activity(
        displayLevel(log) === "error" || event.includes("failed")
          ? "validation_failed"
          : "validate"
      ),
    ]
  }
  if (event.includes("failed")) return [activity("failed")]

  const command = commandFromLog(log)
  if (command) {
    const kind = classifyCommand(command)
    return [activity(kind, targetFromCommand(command, kind))]
  }

  if (event === "tool_call") return [activity("command")]

  return []
}

function activityBatchLevel(logs: AgentChatLog[]): "info" | "warn" | "error" {
  if (logs.some((log) => displayLevel(log) === "error")) return "error"
  if (logs.some((log) => displayLevel(log) === "warn")) return "warn"
  return "info"
}

function formatTargets(
  targets: string[],
  formatter: (target: string) => string
): string {
  if (targets.length === 1) return formatter(targets[0])
  if (targets.length === 2) {
    return `${formatter(targets[0])} and ${formatter(targets[1])}`
  }
  return ""
}

function formatActivityGroup(kind: ActivityKind, group: ActivityGroup): string {
  const meta = ACTIVITY_META[kind]
  const targets = Array.from(group.targets).filter(Boolean)
  const count = group.count

  switch (kind) {
    case "search": {
      const targetText = formatTargets(targets, quoteActivityTarget)
      if (targetText) return `searched for ${targetText}`
      return count > 1 ? `searched ${count} times` : meta.singular
    }
    case "list": {
      const targetText = formatTargets(targets, displayPathTarget)
      if (targetText) return `listed ${targetText}`
      return meta.plural
    }
    case "read":
      if (targets.length === 1) return `read ${displayPathTarget(targets[0])}`
      if (targets.length === 2) {
        return `read ${displayPathTarget(targets[0])} and ${displayPathTarget(
          targets[1]
        )}`
      }
      if (count === 1) return meta.singular
      return `read ${count} files`
    case "edit":
      if (targets.length === 1) return `edited ${displayPathTarget(targets[0])}`
      if (targets.length === 2) {
        return `edited ${displayPathTarget(targets[0])} and ${displayPathTarget(
          targets[1]
        )}`
      }
      if (count === 1) return meta.singular
      return `edited ${count} files`
    case "create":
      if (targets.length === 1)
        return `created ${displayPathTarget(targets[0])}`
      if (targets.length === 2) {
        return `created ${displayPathTarget(targets[0])} and ${displayPathTarget(
          targets[1]
        )}`
      }
      if (count === 1) return meta.singular
      return `created ${count} files`
    case "build":
      if (count === 1) return meta.singular
      return `ran ${count} builds`
    case "url":
      if (targets.length === 1)
        return `checked ${displayPathTarget(targets[0])}`
      if (count === 1) return meta.singular
      return `checked ${count} URLs`
    case "decision":
      if (count === 1) return meta.singular
      return `asked for ${count} decisions`
    case "command":
      if (count === 1) return meta.singular
      return `ran ${count} commands`
    case "command_failed":
      if (count === 1) return meta.singular
      return `${count} commands returned errors`
    case "validation_failed":
      if (count === 1) return meta.singular
      return `validation found ${count} issues`
    default:
      if (count === 1) return meta.singular
      return meta.plural
  }
}

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function joinActivityPieces(pieces: string[]): string {
  if (pieces.length === 0) return "Worked in the repo"
  if (pieces.length === 1) return sentenceCase(pieces[0])
  if (pieces.length === 2) {
    return `${sentenceCase(pieces[0])} and ${pieces[1]}`
  }
  const last = pieces.at(-1)
  return `${sentenceCase(pieces.slice(0, -1).join(", "))}, and ${last}`
}

function displayActivityBatch(logs: AgentChatLog[]): string {
  const groups = new Map<ActivityKind, ActivityGroup>()

  for (const log of logs) {
    for (const item of activityActionsForLog(log)) {
      const group = groups.get(item.kind) ?? {
        count: 0,
        targets: new Set<string>(),
      }
      group.count += 1
      if (item.target) group.targets.add(item.target)
      groups.set(item.kind, group)
    }
  }

  if (groups.has("validation_failed")) groups.delete("validate")
  if (groups.has("command_failed")) groups.delete("command")
  if (groups.size > 1) groups.delete("output")

  if (groups.size === 0) {
    return logs.length === 1 ? displayMessage(logs[0]) : "Worked in the repo"
  }

  const pieces = Array.from(groups.entries())
    .sort((a, b) => ACTIVITY_META[a[0]].order - ACTIVITY_META[b[0]].order)
    .map(([kind, group]) => formatActivityGroup(kind, group))

  return joinActivityPieces(pieces)
}

function AgentActivityGroup({ logs }: { logs: AgentChatLog[] }) {
  const rows = buildAgentActivityRows(logs)

  return (
    <div className="space-y-4">
      {rows.map((row) =>
        row.type === "activity" ? (
          <ActivityBatchRow
            key={`activity-${row.logs[0]?.id ?? "empty"}-${row.logs.at(-1)?.id ?? "empty"}`}
            logs={row.logs}
          />
        ) : (
          <AgentMessageRow key={row.log.id} log={row.log} />
        )
      )}
    </div>
  )
}

function AgentMessageRow({ log }: { log: AgentChatLog }) {
  const level = displayLevel(log)

  return (
    // Agent narration uses its own log level. Do not inherit warning/error
    // color from nearby tool rows, or normal fixing narration turns yellow.
    <div
      className={cn(
        "text-sm leading-6 text-foreground",
        level === "error" && "text-destructive",
        level === "warn" && "text-warning"
      )}
    >
      <Markdown>{displayMessage(log)}</Markdown>
    </div>
  )
}

function UserMessageGroup({ logs }: { logs: AgentChatLog[] }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] space-y-2 rounded-lg bg-primary px-3 py-2 text-left text-sm leading-6 text-primary-foreground">
        {logs.map((log) => (
          <p key={log.id}>{displayMessage(log)}</p>
        ))}
      </div>
    </div>
  )
}

function ActivityBatchRow({ logs }: { logs: AgentChatLog[] }) {
  const level = activityBatchLevel(logs)

  return (
    // Tool/command rows are intentionally lower-emphasis than agent messages.
    <div
      className={cn(
        "flex items-start gap-2 py-0.5 text-xs leading-5 text-foreground/40",
        level === "warn" && "text-warning",
        level === "error" && "text-destructive"
      )}
    >
      {activityBatchIcon(logs)}
      <span className="min-w-0 flex-1 whitespace-pre-wrap">
        {displayActivityBatch(logs)}
      </span>
    </div>
  )
}

function activityBatchIcon(logs: AgentChatLog[]) {
  const representative =
    logs.find((log) => displayLevel(log) === "error") ??
    logs.find((log) => log.event === "file_change") ??
    logs.find((log) => log.event.includes("pr_")) ??
    logs.find(
      (log) => log.event.includes("verify") || log.event.includes("rescan")
    ) ??
    logs.find(
      (log) => log.event.includes("clone") || log.event.includes("repo")
    ) ??
    logs[0]

  return activityIcon(representative)
}

function activityIcon(log: AgentChatLog) {
  const className = "mt-0.5 size-3.5 shrink-0"

  if (log.event === "file_change") {
    return <PencilSimpleIcon className={className} />
  }
  if (
    log.event === "pr_opened" ||
    log.event === "pr_updated" ||
    log.message.toLowerCase().includes("pull request")
  ) {
    return <GitPullRequestIcon className={className} />
  }
  if (
    log.event.includes("clone") ||
    log.event.includes("repo") ||
    log.message.toLowerCase().includes("cloning")
  ) {
    return <GitPullRequestIcon className={className} />
  }
  if (log.event.includes("verify") || log.event.includes("rescan")) {
    return <ArrowsClockwiseIcon className={className} />
  }
  if (log.event.includes("sandbox")) return <RobotIcon className={className} />
  if (log.event.includes("failed")) return <WarningIcon className={className} />
  return <TerminalIcon className={className} />
}

function formatAiCredits(value: number): string {
  if (value >= 1_000_000) {
    return `${Number(value / 1_000_000).toLocaleString(undefined, {
      maximumFractionDigits: 1,
    })}M`
  }
  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString()}K`
  return value.toLocaleString()
}

function Composer({ run }: { run: AgentRunDetail }) {
  const sendChat = useSendChat(run.id)
  const [text, setText] = React.useState("")
  const editorRef = React.useRef<HTMLDivElement>(null)
  const sending = sendChat.isPending || run.status === "CHATTING"

  if (run.status === "FAILED" || run.status === "CANCELED") {
    return (
      <div className="bg-secondary p-3">
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-foreground/70">
          <WarningIcon className="size-4" />
          Chat is unavailable because this agent thread stopped.
        </div>
      </div>
    )
  }

  if (!run.prUrl) {
    return (
      <div className="bg-secondary p-3">
        <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-foreground/70">
          <PaperPlaneTiltIcon className="size-4" />
          Chat opens once the fix PR is created.
        </div>
      </div>
    )
  }

  const noBudget = run.aiCreditsLeft <= 0
  const followUpMode = run.prState === "MERGED" || run.prState === "CLOSED"

  async function onSend() {
    const m = text.trim()
    if (!m) return
    setText("")
    if (editorRef.current) editorRef.current.textContent = ""
    try {
      await sendChat.mutateAsync(m)
    } catch (e) {
      setText(m)
      if (editorRef.current) editorRef.current.textContent = m
      toast.error(
        e instanceof Error ? e.message : "Could not send the message."
      )
    }
  }

  if (noBudget) {
    return (
      <div className="bg-secondary p-3">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-foreground/70">
          <span>You&apos;ve used the follow-up AI credits for this agent.</span>
          <Button asChild size="xs" variant="secondary">
            <Link href="/dashboard/support">Add credits</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-2 space-y-2 rounded-lg bg-secondary p-3">
      {/* Composer: contentEditable avoids password-manager overlays that attach to real inputs/textareas. */}
      <div className="relative">
        {!text ? (
          <span className="pointer-events-none absolute top-2 left-2.5 text-xs leading-5 text-muted-foreground">
            {followUpMode
              ? "Ask for a follow-up change..."
              : "Ask the agent to tweak the fix..."}
          </span>
        ) : null}
        <div
          ref={editorRef}
          role="textbox"
          aria-label="Message the agent"
          aria-multiline="true"
          aria-disabled={sending}
          tabIndex={sending ? -1 : 0}
          contentEditable={sending ? false : "plaintext-only"}
          suppressContentEditableWarning
          data-1p-ignore="true"
          data-bwignore="true"
          data-dashlane-ignore="true"
          data-disable-autofill="true"
          data-lpignore="true"
          data-protonpass-ignore="true"
          data-form-type="other"
          onInput={(e) =>
            setText(e.currentTarget.innerText.replace(/\u00a0/g, " "))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void onSend()
            }
          }}
          className={cn(
            "min-h-10 w-full rounded-lg bg-background px-2.5 py-2 text-xs leading-5 text-foreground transition-colors outline-none empty:before:content-[''] focus-visible:ring-1 focus-visible:ring-ring/50",
            sending ? "cursor-not-allowed opacity-50" : "cursor-text"
          )}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-foreground/65">
          {formatAiCredits(run.aiCreditsLeft)} AI credits left
        </span>
        <Button
          size="icon-sm"
          disabled={sending || !text.trim()}
          aria-label="Send message"
          aria-busy={sending}
          onClick={onSend}
        >
          {sending ? (
            <SpinnerGapIcon className="size-3.5 animate-spin" />
          ) : (
            <ArrowRightIcon className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}

function Empty({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="grid place-items-center rounded-xl bg-background py-12 text-center">
      {icon ? <span className="mb-2 text-foreground/70">{icon}</span> : null}
      <p className="text-xs text-foreground/70">{text}</p>
    </div>
  )
}
