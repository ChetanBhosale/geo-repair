"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import {
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageLoader } from "@/components/page-loader"
import { useBreadcrumbs } from "@/context/breadcrumb"
import { AgentProvider, useAgent } from "@/context/agent"
import { useSendChat, useStartFix } from "@/query/agent.query"
import { Markdown } from "@/components/markdown"

type Mode = "AUTO" | "NEEDS_INPUT"

const RUN_BADGE: Record<AgentRunStatus, string> = {
  QUEUED: "bg-muted text-muted-foreground",
  PLANNING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  AWAITING_INPUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  FIXING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  VERIFYING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  OPENING_PR: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PR_OPENED: "bg-primary/10 text-primary",
  CHATTING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  COMPLETED: "bg-primary/10 text-primary",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELED: "bg-muted text-muted-foreground",
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

  if (isLoading && !run) return <PageLoader />
  if (!run) {
    return (
      <div className="grid h-[calc(100svh-3.5rem)] place-items-center px-6 text-center text-sm text-muted-foreground">
        This agent run could not be found.
      </div>
    )
  }

  const planning = run.status === "QUEUED" || run.status === "PLANNING"
  const needsInput = checks.filter((c) => c.mode === "NEEDS_INPUT")
  const autoCount = checks.filter((c) => c.mode === "AUTO").length
  const manualCount = plan?.manual.length ?? 0
  // Locked once the plan has been submitted (anything past awaiting input).
  const locked = run.status !== "AWAITING_INPUT"

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0">
      {/* LEFT: chat thread -------------------------------------------------- */}
      <div className="flex w-full max-w-md min-w-0 flex-col border-r border-border lg:max-w-lg">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-lg bg-accent text-accent-foreground">
              <RobotIcon className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium leading-tight">Fix agent</p>
              <p className="font-mono text-[11px] text-muted-foreground">{run.id}</p>
            </div>
          </div>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", RUN_BADGE[run.status])}>
            {run.status.replace("_", " ").toLowerCase()}
          </span>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5">
          {logs.length === 0 && planning ? (
            <ChatBubble event="starting">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <SpinnerGapIcon className="size-3.5 animate-spin" /> Starting up...
              </span>
            </ChatBubble>
          ) : null}

          {/* All logs in order; the plan card is injected at its own log so fix
              logs naturally follow below it. */}
          {logs.map((l) =>
            l.planId ? (
              plan && plan.summary ? (
                <PlanMessage
                  key={l.id}
                  runId={run.id}
                  status={run.status}
                  locked={locked}
                  summary={plan.summary}
                  checks={checks}
                  manual={plan.manual}
                  needsInput={needsInput}
                  autoCount={autoCount}
                  manualCount={manualCount}
                />
              ) : null
            ) : (
              <LogBubble key={l.id} log={l} />
            )
          )}

          {planning && !plan?.summary ? (
            <ChatBubble event="planning">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <SpinnerGapIcon className="size-3.5 animate-spin" /> Building the plan...
              </span>
            </ChatBubble>
          ) : null}

          {run.status === "FAILED" ? (
            <ChatBubble event="failed" level="error">
              {run.error ?? "The run failed."}
            </ChatBubble>
          ) : null}
        </div>

        <Composer run={run} />
      </div>

      {/* RIGHT: checks / changes / code ------------------------------------ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex items-center gap-4">
            <ScoreMeta label="Score before" value={run.scoreBefore} />
            <ArrowsClockwiseIcon className="size-4 text-muted-foreground" />
            <ScoreMeta label={run.scoreAfter != null ? "Score after" : "Target"} value={run.scoreAfter ?? 100} accent />
          </div>
          <Button size="sm" variant="outline" asChild={!!run.prUrl} disabled={!run.prUrl}>
            {run.prUrl ? (
              <a href={run.prUrl} target="_blank" rel="noreferrer">
                <GitPullRequestIcon className="size-3.5" />
                View PR
              </a>
            ) : (
              <span>
                <GitPullRequestIcon className="size-3.5" />
                PR not opened yet
              </span>
            )}
          </Button>
        </div>

        <Tabs defaultValue="checks" className="min-h-0 flex-1 gap-0">
          <div className="border-b border-border px-5 pt-3">
            <TabsList variant="line">
              <TabsTrigger value="checks">Checks ({checks.length})</TabsTrigger>
              <TabsTrigger value="changes">Changes</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="checks" className="min-h-0 overflow-y-auto px-5 py-4">
            {checks.length === 0 ? (
              <Empty text={planning ? "Planning in progress..." : "No checks planned."} />
            ) : (
              <div className="space-y-2">
                {checks.map((c) => (
                  <CheckCard key={c.id} check={c} />
                ))}
                {(plan?.manual ?? []).map((m) => (
                  <ManualCard key={m.rubricId} rubricId={m.rubricId} reason={m.reason} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="changes" className="min-h-0 overflow-y-auto px-5 py-4">
            <ChangesView checks={checks} fileLogs={fileLogs} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// --- chat primitives --------------------------------------------------------

function ChatBubble({
  event,
  level = "info",
  children,
}: {
  event: string
  level?: "info" | "warn" | "error"
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
        <RobotIcon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium">Fix agent</span>
          <span className="font-mono text-[10px] text-muted-foreground/70">{event}</span>
        </div>
        <div
          className={cn(
            "rounded-xl rounded-tl-sm border border-border bg-card px-3 py-2.5 text-xs leading-relaxed",
            level === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
            level === "warn" && "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function PlanMessage({
  runId,
  status,
  locked,
  summary,
  checks,
  needsInput,
  autoCount,
  manualCount,
  manual,
}: {
  runId: string
  status: AgentRunStatus
  locked: boolean
  summary: string
  checks: AgentPlanCheckDTO[]
  needsInput: AgentPlanCheckDTO[]
  autoCount: number
  manualCount: number
  manual: { rubricId: string; reason: string }[]
}) {
  const startFix = useStartFix(runId)

  // Seed answers from the stored choices so a submitted plan shows the picks.
  const [answers, setAnswers] = React.useState<
    Record<string, { selectedOption: string | null; note: string }>
  >(() =>
    Object.fromEntries(
      needsInput.map((c) => [c.rubricId, { selectedOption: c.selectedOption, note: c.userSuggestion ?? "" }])
    )
  )

  const answeredCount = needsInput.filter((c) => answers[c.rubricId]?.selectedOption).length
  // Validation: every question must be answered to enable submit.
  const allAnswered = needsInput.length === 0 || answeredCount === needsInput.length
  const disabled = locked || startFix.isPending || !allAnswered

  function pick(rubricId: string, optionId: string) {
    if (locked) return
    setAnswers((p) => ({ ...p, [rubricId]: { selectedOption: optionId, note: p[rubricId]?.note ?? "" } }))
  }
  function setNote(rubricId: string, note: string) {
    if (locked) return
    setAnswers((p) => ({ ...p, [rubricId]: { selectedOption: p[rubricId]?.selectedOption ?? null, note } }))
  }

  async function onSubmit() {
    const payload: AgentPlanAnswer[] = needsInput.map((c) => {
      const a = answers[c.rubricId]
      const selected = a?.selectedOption ?? null
      return {
        rubricId: c.rubricId,
        choice: selected === "no" ? "DECLINED" : "APPROVED",
        selectedOption: selected,
        userSuggestion: a?.note || null,
      }
    })
    try {
      await startFix.mutateAsync(payload)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the fix run.")
    }
  }

  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
        <RobotIcon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium">Fix agent</span>
          <span className="font-mono text-[10px] text-muted-foreground/70">plan</span>
        </div>
        <div className="rounded-xl rounded-tl-sm border border-border bg-card px-3.5 py-3 text-xs">
          <p className="leading-relaxed text-foreground/80">{summary}</p>
          <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
            <Pill className="bg-primary/10 text-primary">{autoCount} auto-fix</Pill>
            <Pill className="bg-amber-500/10 text-amber-600 dark:text-amber-400">{needsInput.length} need you</Pill>
            <Pill className="bg-muted text-muted-foreground">{manualCount} manual</Pill>
          </div>

          <ol className="mt-3 space-y-3">
            {checks.map((c, i) => (
              <li key={c.id}>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">{i + 1}.</span>
                  <span className="font-mono text-xs font-semibold">{c.rubricId}</span>
                  <ModeTag mode={c.mode} />
                </div>
                {c.approach ? (
                  <p className="mt-0.5 pl-4 text-xs leading-relaxed text-foreground/80">{c.approach}</p>
                ) : null}

                {c.mode === "NEEDS_INPUT" && c.options ? (
                  <div className="mt-2 pl-4">
                    {c.question ? (
                      <p className="mb-1.5 text-xs font-medium text-foreground/90">{c.question}</p>
                    ) : null}
                    <div className="flex flex-col gap-1.5">
                      {c.options.map((opt) => {
                        const active = answers[c.rubricId]?.selectedOption === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={locked}
                            onClick={() => pick(c.rubricId, opt.id)}
                            className={cn(
                              "rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors disabled:opacity-70",
                              active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                            )}
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <span
                                className={cn(
                                  "size-3 rounded-full border",
                                  active ? "border-primary bg-primary" : "border-muted-foreground/40"
                                )}
                              />
                              {opt.label}
                            </span>
                            {opt.description ? (
                              <span className="mt-0.5 block pl-4.5 text-[11px] text-muted-foreground">
                                {opt.description}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                    <Textarea
                      value={answers[c.rubricId]?.note ?? ""}
                      disabled={locked}
                      onChange={(e) => setNote(c.rubricId, e.target.value)}
                      placeholder="Add a note for the agent (optional)"
                      className="mt-1.5 min-h-9"
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>

          {manual.length > 0 ? (
            <div className="mt-3 rounded-md border border-dashed border-border px-3 py-2">
              <p className="text-[11px] font-medium text-muted-foreground">Flagged for manual work</p>
              {manual.map((m) => (
                <p key={m.rubricId} className="mt-1 text-xs text-muted-foreground">
                  <span className="font-mono">{m.rubricId}</span> {m.reason}
                </p>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="text-[11px] text-muted-foreground">
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
                Submit plan
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ModeTag({ mode }: { mode: Mode | "MANUAL" }) {
  const map: Record<string, string> = {
    AUTO: "bg-primary/10 text-primary",
    NEEDS_INPUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    MANUAL: "bg-muted text-muted-foreground",
  }
  const label: Record<string, string> = { AUTO: "auto-fix", NEEDS_INPUT: "needs you", MANUAL: "manual" }
  return <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", map[mode])}>{label[mode]}</span>
}

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("rounded-full px-2 py-0.5 font-medium", className)}>{children}</span>
}

// --- right panel pieces -----------------------------------------------------

function ScoreMeta({ label, value, accent }: { label: string; value: number | null; accent?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-semibold", accent && "text-primary")}>
        {value ?? "--"}
        <span className="text-xs font-normal text-muted-foreground"> / 100</span>
      </p>
    </div>
  )
}

function CheckCard({ check }: { check: AgentPlanCheckDTO }) {
  const outcomeBadge =
    check.outcome === "FIXED"
      ? "bg-primary/10 text-primary"
      : check.outcome === "FAILED"
        ? "bg-destructive/10 text-destructive"
        : check.outcome === "SKIPPED_BY_USER"
          ? "bg-muted text-muted-foreground"
          : null
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircleIcon className="size-4 text-primary" />
          <span className="font-mono text-sm font-medium">{check.rubricId}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {outcomeBadge ? (
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", outcomeBadge)}>
              {check.outcome.replace(/_/g, " ").toLowerCase()}
            </span>
          ) : null}
          <ModeTag mode={check.mode} />
        </div>
      </div>
      {check.approach ? (
        <p className="mt-2 text-xs leading-relaxed text-foreground/80">{check.approach}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>{check.category}</span>
        <span>·</span>
        <span>tier {check.tier}</span>
        <span>·</span>
        <span>weight {check.weight}</span>
      </div>
      {check.targetPages.length > 0 ? (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          {check.targetPages.map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span
                className={cn(
                  "mt-0.5 rounded px-1 py-0.5 font-mono text-[10px] uppercase",
                  p.action === "create"
                    ? "bg-primary/10 text-primary"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}
              >
                {p.action}
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-foreground/80">{p.url}</p>
                <p className="text-muted-foreground">{p.reason}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ManualCard({ rubricId, reason }: { rubricId: string; reason: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <WarningIcon className="size-4 text-muted-foreground" />
          <span className="font-mono text-sm font-medium">{rubricId}</span>
        </div>
        <ModeTag mode="MANUAL" />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-foreground/80">{reason}</p>
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
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {changes.map((l, i) => {
          const d = (l.data ?? {}) as { path?: string; action?: string; rubricId?: string }
          return (
            <div
              key={l.id}
              className={cn("flex items-start gap-3 px-4 py-3", i > 0 && "border-t border-border")}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md",
                  d.action === "create" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}
              >
                {d.action === "create" ? <PlusIcon className="size-3.5" /> : <PencilSimpleIcon className="size-3.5" />}
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-medium">{d.path ?? l.message}</p>
                {d.rubricId ? (
                  <span className="mt-0.5 inline-block font-mono text-[10px] text-muted-foreground/70">{d.rubricId}</span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Pre-fix: show the planned target pages.
  const planned = checks.flatMap((c) => c.targetPages.map((p) => ({ ...p, rubricId: c.rubricId })))
  if (planned.length === 0) return <Empty text="No file changes yet." />
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {planned.map((f, i) => (
        <div key={`${f.rubricId}-${i}`} className={cn("flex items-start gap-3 px-4 py-3", i > 0 && "border-t border-border")}>
          <span
            className={cn(
              "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md",
              f.action === "create" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}
          >
            {f.action === "create" ? <PlusIcon className="size-3.5" /> : <PencilSimpleIcon className="size-3.5" />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-xs font-medium">{f.url}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{f.reason}</p>
            <span className="mt-1 inline-block font-mono text-[10px] text-muted-foreground/70">{f.rubricId}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Renders a single log in the chat: USER messages right-aligned, AGENT_FILE
// command/file/read events as a compact terminal row, everything else as a
// normal agent bubble.
function LogBubble({ log }: { log: AgentChatLog }) {
  if (log.source === "USER") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-primary px-3 py-2 text-xs leading-relaxed text-primary-foreground">
          {log.message}
        </div>
      </div>
    )
  }

  const terminalEvent =
    log.source === "AGENT_FILE" &&
    (log.event === "command" || log.event === "read" || log.event === "file_change")

  if (terminalEvent) {
    return (
      <div className="flex gap-2.5">
        <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          {log.event === "file_change" ? (
            <PencilSimpleIcon className="size-4" />
          ) : (
            <TerminalIcon className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <pre className="overflow-x-auto rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-[11px] whitespace-pre-wrap text-foreground/80">
            {log.message}
          </pre>
        </div>
      </div>
    )
  }

  const level =
    log.event === "verify_failed" ? "warn" : log.level === "debug" ? "info" : log.level
  return (
    <ChatBubble event={log.event} level={level}>
      <Markdown>{log.message}</Markdown>
    </ChatBubble>
  )
}

function Composer({ run }: { run: AgentRunDetail }) {
  const sendChat = useSendChat(run.id)
  const [text, setText] = React.useState("")
  const sending = sendChat.isPending || run.status === "CHATTING"

  if (!run.prUrl) {
    return (
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <PaperPlaneTiltIcon className="size-4" />
          Chat opens once the fix PR is created.
        </div>
      </div>
    )
  }

  const closed = run.prMerged
  const noBudget = run.chatMessagesLeft <= 0

  async function onSend() {
    const m = text.trim()
    if (!m) return
    try {
      await sendChat.mutateAsync(m)
      setText("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the message.")
    }
  }

  // PR merged: run is complete. Keep the box visible but disabled, and turn the
  // send button into a clear "PR merged" state.
  if (closed) {
    return (
      <div className="space-y-2 border-t border-border p-3">
        <Textarea
          value=""
          disabled
          placeholder="This run is complete. The PR has been merged."
          className="min-h-10 cursor-not-allowed"
        />
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
            <GitPullRequestIcon className="size-3.5" weight="fill" />
            PR merged
          </span>
          <Button
            size="sm"
            disabled
            className="bg-primary/15 text-primary hover:bg-primary/15"
          >
            <CheckCircleIcon className="size-3.5" weight="fill" />
            PR merged
          </Button>
        </div>
      </div>
    )
  }

  if (noBudget) {
    return (
      <div className="border-t border-border p-3">
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
          You&apos;ve used all your chat messages for this run.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 border-t border-border p-3">
      <Textarea
        value={text}
        disabled={sending}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            void onSend()
          }
        }}
        placeholder="Ask the agent to tweak the fix (e.g. use a different OG image)..."
        className="min-h-10"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {sending ? "Agent is working..." : `${run.chatMessagesLeft} message${run.chatMessagesLeft === 1 ? "" : "s"} left`}
        </span>
        <Button size="sm" disabled={sending || !text.trim()} onClick={onSend}>
          {sending ? <SpinnerGapIcon className="size-3.5 animate-spin" /> : <PaperPlaneTiltIcon className="size-3.5" />}
          Send
        </Button>
      </div>
    </div>
  )
}

function Empty({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border py-12 text-center">
      {icon ? <span className="mb-2 text-muted-foreground">{icon}</span> : null}
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}
