"use client"

import * as React from "react"
import Link from "next/link"
import { ExternalLink, GitBranch, Loader2, Play } from "lucide-react"
import type {
  FixIntakeQuestionId,
  FixRunDetail,
  FixRunIntake,
  FixRunState,
  RunEventView,
} from "@repo/types/fix"
import { loginWithGithub, useUser } from "@/hooks/use-auth"
import { useFixRun, useFixRuns, useStartFix } from "@/hooks/use-fix"
import { useSavedRepos } from "@/hooks/use-repos"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input"
import { DashboardShell } from "@/components/dashboard-shell"
import { StatePanel } from "@/components/state-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type TechTab = "diff" | "console" | "logs" | "terminal"

const techTabs: Array<{ id: TechTab; label: string }> = [
  { id: "diff", label: "Diff" },
  { id: "console", label: "Console" },
  { id: "logs", label: "Logs" },
  { id: "terminal", label: "Terminal" },
]

type IntakeOption = {
  id: string
  label: string
  description: string
}

type IntakeQuestion = {
  id: FixIntakeQuestionId
  question: string
  notePlaceholder: string
  options: IntakeOption[]
}

const intakeQuestions: IntakeQuestion[] = [
  {
    id: "visible_copy",
    question: "How much visible page copy can the agent adjust?",
    notePlaceholder: "Any sections or phrases to preserve?",
    options: [
      {
        id: "tighten_existing",
        label: "Tighten existing copy",
        description: "Small clarity edits to content already on the site.",
      },
      {
        id: "structural_only",
        label: "Structural only",
        description: "Metadata, schema, links, labels, and crawler fixes only.",
      },
      {
        id: "new_sections_allowed",
        label: "New sections allowed",
        description:
          "Short FAQ or definition blocks when your notes support it.",
      },
    ],
  },
  {
    id: "new_content",
    question: "What net-new content is allowed?",
    notePlaceholder: "Add FAQ questions and canonical answers here if allowed.",
    options: [
      {
        id: "none",
        label: "No new content",
        description: "Use only existing website copy.",
      },
      {
        id: "faq_from_notes",
        label: "FAQ from notes",
        description: "Add FAQ answers only from details you provide.",
      },
      {
        id: "definitions_and_faq",
        label: "Definitions and FAQ",
        description:
          "Add concise answer-first blocks from your provided facts.",
      },
    ],
  },
  {
    id: "claims",
    question: "What factual claims can it add?",
    notePlaceholder: "List approved facts, stats, pricing, or claims to avoid.",
    options: [
      {
        id: "no_new_claims",
        label: "No new claims",
        description: "Do not add facts that are not already on the site.",
      },
      {
        id: "provided_facts_only",
        label: "Provided facts only",
        description: "Use only facts you write in the notes.",
      },
      {
        id: "flag_uncertain",
        label: "Flag uncertain items",
        description: "Skip edits when facts are unclear.",
      },
    ],
  },
  {
    id: "visual_changes",
    question: "How much layout or design change is okay?",
    notePlaceholder:
      "Mention pages, components, or layouts that are off-limits.",
    options: [
      {
        id: "keep_layout",
        label: "Keep layout",
        description:
          "No visual restructuring unless required for accessibility.",
      },
      {
        id: "minor_polish",
        label: "Minor polish",
        description: "Small spacing, label, and semantic markup adjustments.",
      },
      {
        id: "simple_blocks",
        label: "Simple blocks",
        description: "Add compact content blocks when needed.",
      },
    ],
  },
  {
    id: "review_preference",
    question: "What should the agent prioritize when tradeoffs come up?",
    notePlaceholder: "Anything the PR should explicitly call out?",
    options: [
      {
        id: "small_safe_pr",
        label: "Small safe PR",
        description: "Prefer fewer, lower-risk changes.",
      },
      {
        id: "score_lift",
        label: "Score lift",
        description: "Prioritize the largest readiness improvements.",
      },
      {
        id: "flag_more",
        label: "Flag more",
        description: "Skip uncertain edits and explain why.",
      },
    ],
  },
]

const defaultIntakeAnswers: Record<FixIntakeQuestionId, string> = {
  visible_copy: "tighten_existing",
  new_content: "none",
  claims: "no_new_claims",
  visual_changes: "keep_layout",
  review_preference: "small_safe_pr",
}

const activeStates: FixRunState[] = [
  "QUEUED",
  "SCANNING",
  "CLONING",
  "FIXING",
  "VERIFYING",
  "PUSHING",
]

function stateLabel(state: FixRunState) {
  return state.replaceAll("_", " ").toLowerCase()
}

function stateVariant(state: FixRunState) {
  if (state === "FAILED") {
    return "fail" as const
  }
  if (state === "PR_OPENED" || state === "COMPLETED") {
    return "pass" as const
  }
  return "partial" as const
}

function eventBody(event: RunEventView) {
  const payload = event.payload ?? {}
  const message =
    typeof payload.message === "string"
      ? payload.message
      : typeof payload.error === "string"
        ? payload.error
        : typeof payload.prUrl === "string"
          ? `Pull request opened: ${payload.prUrl}`
          : null

  return (
    message ??
    `Event ${event.type}${event.phase ? ` during ${event.phase}` : ""}.`
  )
}

function eventStatus(event: RunEventView) {
  if (event.type.toLowerCase().includes("error")) {
    return "border-destructive/40 bg-destructive/5"
  }
  if (event.type.toLowerCase().includes("pr")) {
    return "border-emerald-500/40 bg-emerald-500/5"
  }
  return "border-border bg-card"
}

function findOption(question: IntakeQuestion, answerId: string) {
  return (
    question.options.find((option) => option.id === answerId) ??
    question.options[0]
  )
}

function buildIntake(
  answers: Record<FixIntakeQuestionId, string>,
  notes: Partial<Record<FixIntakeQuestionId, string>>
): FixRunIntake {
  return {
    version: 1,
    submittedAt: new Date().toISOString(),
    answers: intakeQuestions.map((question) => {
      const option = findOption(question, answers[question.id])

      return {
        questionId: question.id,
        question: question.question,
        answerId: option.id,
        answerLabel: option.label,
        notes: notes[question.id]?.trim() || null,
      }
    }),
  }
}

function eventPayload(event: RunEventView) {
  return event.payload ?? {}
}

function commandFromEvent(event: RunEventView) {
  const payload = eventPayload(event)
  const args = payload.toolArgs
  if (args && typeof args === "object" && "command" in args) {
    const command = (args as { command?: unknown }).command
    return typeof command === "string" ? command : null
  }
  return null
}

export default function FixAgentPage() {
  const { isLoading, isSignedIn } = useUser()
  const savedRepos = useSavedRepos(isSignedIn)
  const runs = useFixRuns(isSignedIn)
  const startFix = useStartFix()
  const [website, setWebsite] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<TechTab>("console")
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null)
  const [intakeAnswers, setIntakeAnswers] =
    React.useState<Record<FixIntakeQuestionId, string>>(defaultIntakeAnswers)
  const [intakeNotes, setIntakeNotes] = React.useState<
    Partial<Record<FixIntakeQuestionId, string>>
  >({})
  const [refinement, setRefinement] = React.useState(
    "Keep the FAQ copy shorter and avoid changing the hero section."
  )

  const repositories = savedRepos.data ?? []
  const selectedRepo =
    repositories.find((repository) => repository.selected) ??
    repositories[0] ??
    null
  const runList = runs.data ?? []

  const selectedRun =
    runList.find((run) => run.id === selectedRunId) ?? runList[0] ?? null
  const detail = useFixRun(selectedRun?.id ?? null, isSignedIn)
  const activeRun = selectedRun
    ? activeStates.includes(selectedRun.state)
    : false
  const transcriptEvents =
    detail.data?.events.filter((event) => event.type !== "intake_submitted") ??
    []

  function onStartFix(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedRepo || !website.trim()) {
      return
    }
    startFix.mutate({
      repositoryId: selectedRepo.id,
      website: website.trim(),
      intake: buildIntake(intakeAnswers, intakeNotes),
    })
  }

  return (
    <DashboardShell
      eyebrow="Fix agent"
      title="Run workspace"
      actions={
        selectedRun?.prUrl ? (
          <Button asChild variant="outline">
            <a href={selectedRun.prUrl} rel="noreferrer" target="_blank">
              View PR
              <ExternalLink className="size-4" />
            </a>
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <StatePanel
          eyebrow="Loading"
          title="Loading fix workspace"
          description="We are checking your session and project access."
          action={
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          }
        />
      ) : null}

      {!isLoading && !isSignedIn ? (
        <StatePanel
          eyebrow="GitHub required"
          title="Connect GitHub before running the fix agent"
          description="The fix agent can only work after a repository is selected for the active project."
          action={
            <Button onClick={loginWithGithub}>
              <GitBranch className="size-4" />
              Continue with GitHub
            </Button>
          }
        />
      ) : null}

      {isSignedIn && !savedRepos.isLoading && !selectedRepo ? (
        <StatePanel
          eyebrow="No repository"
          title="Choose a repository before starting a fix"
          description="The execution plane opens a PR against one selected repo. Choose it in settings first."
          action={
            <Button asChild>
              <Link href="/settings">
                <GitBranch className="size-4" />
                Open settings
              </Link>
            </Button>
          }
        />
      ) : null}

      {isSignedIn && selectedRepo ? (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(340px,0.55fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Start a fix run</CardTitle>
              <CardDescription>
                Confirm the website for {selectedRepo.fullName}. The backend
                creates a fix run and starts the Temporal workflow.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4">
                <div>
                  <h2 className="text-sm font-semibold">
                    Agent clarification questions
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    These answers become hard constraints for what the agent may
                    change or add.
                  </p>
                </div>

                {intakeQuestions.map((question) => (
                  <fieldset
                    className="grid gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0"
                    key={question.id}
                  >
                    <legend className="text-sm font-medium">
                      {question.question}
                    </legend>
                    <div className="grid gap-2 md:grid-cols-3">
                      {question.options.map((option) => {
                        const selected =
                          intakeAnswers[question.id] === option.id

                        return (
                          <button
                            className={cn(
                              "rounded-lg border p-3 text-left transition-colors",
                              selected
                                ? "border-foreground bg-background"
                                : "border-border bg-background/70 hover:bg-muted"
                            )}
                            key={option.id}
                            onClick={() =>
                              setIntakeAnswers((current) => ({
                                ...current,
                                [question.id]: option.id,
                              }))
                            }
                            type="button"
                          >
                            <span className="block text-sm font-medium">
                              {option.label}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                              {option.description}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <textarea
                      className="min-h-18 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      onChange={(event) =>
                        setIntakeNotes((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                      placeholder={question.notePlaceholder}
                      value={intakeNotes[question.id] ?? ""}
                    />
                  </fieldset>
                ))}
              </div>

              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={onStartFix}
              >
                <Input
                  disabled={startFix.isPending}
                  inputMode="url"
                  onChange={(event) => setWebsite(event.target.value)}
                  placeholder="https://example.com"
                  type="text"
                  value={website}
                />
                <Button
                  disabled={!website.trim() || startFix.isPending}
                  type="submit"
                >
                  {startFix.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  Start fix
                </Button>
              </form>
              {startFix.isError ? (
                <p className="mt-3 text-sm text-destructive">
                  {(startFix.error as Error).message}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Run history</CardTitle>
              <CardDescription>
                Select a run to inspect its transcript and technical detail.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {runs.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading runs
                </p>
              ) : null}
              {runs.isError ? (
                <p className="text-sm text-destructive">
                  {(runs.error as Error).message}
                </p>
              ) : null}
              {!runs.isLoading && runList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No fix runs yet.
                </p>
              ) : null}
              {runList.map((run) => (
                <button
                  className={cn(
                    "rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted",
                    selectedRun?.id === run.id && "bg-muted"
                  )}
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {run.website}
                    </span>
                    <Badge variant={stateVariant(run.state)}>
                      {stateLabel(run.state)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {run.fixedChecks}/{run.totalChecks} checks fixed
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {isSignedIn && selectedRun ? (
        <section className="grid min-h-[640px] gap-4 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
          <Card className="min-h-0 overflow-hidden py-0">
            <CardHeader className="border-b border-border py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Agent chat log</CardTitle>
                  <CardDescription>
                    Read-only during the main run. Refinement opens after PR.
                  </CardDescription>
                </div>
                <Badge variant={stateVariant(selectedRun.state)}>
                  {activeRun ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : null}
                  {stateLabel(selectedRun.state)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-[540px] p-0">
              <Conversation>
                <ConversationContent>
                  {detail.isLoading ? (
                    <ConversationEmptyState
                      title="Loading run transcript"
                      description="Fetching events, checks, and PR state."
                      icon={<Loader2 className="size-4 animate-spin" />}
                    />
                  ) : null}

                  {detail.data?.intake ? (
                    <Message className="border-border bg-muted/30" from="user">
                      <MessageContent className="border-0 bg-transparent p-0">
                        <h3 className="text-sm font-medium">
                          Clarification answers
                        </h3>
                        <div className="grid gap-2">
                          {detail.data.intake.answers.map((answer) => (
                            <div
                              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                              key={answer.questionId}
                            >
                              <p className="font-medium">{answer.question}</p>
                              <p className="mt-1 text-muted-foreground">
                                {answer.answerLabel}
                              </p>
                              {answer.notes ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Note: {answer.notes}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </MessageContent>
                    </Message>
                  ) : null}

                  {detail.data && transcriptEvents.length === 0 ? (
                    <ConversationEmptyState
                      title="No transcript events yet"
                      description="The agent log starts once the workflow appends run events."
                    />
                  ) : null}

                  {transcriptEvents.map((event) => (
                    <Message
                      className={eventStatus(event)}
                      from="assistant"
                      key={event.seq}
                    >
                      <MessageContent className="border-0 bg-transparent p-0">
                        <div className="flex items-center justify-between gap-2 font-mono text-xs tracking-wide text-muted-foreground uppercase">
                          <span>#{event.seq}</span>
                          <span>{event.phase ?? event.type}</span>
                        </div>
                        <h3 className="text-sm font-medium">{event.type}</h3>
                        <MessageResponse>{eventBody(event)}</MessageResponse>
                      </MessageContent>
                    </Message>
                  ))}

                  {detail.data?.state === "PR_OPENED" ||
                  detail.data?.state === "COMPLETED" ? (
                    <Message
                      className="border-emerald-500/40 bg-emerald-500/5"
                      from="assistant"
                    >
                      <MessageContent className="border-0 bg-transparent p-0">
                        <h3 className="text-sm font-medium">Refine this PR</h3>
                        <MessageResponse>
                          Post-PR Refinement Mode is the only place users can
                          free-form chat. The backend endpoint is still pending,
                          so this composer is staged as UI only.
                        </MessageResponse>
                        <PromptInput
                          onSubmit={(message) => setRefinement(message.text)}
                        >
                          <PromptInputTextarea
                            aria-label="Refinement request"
                            onChange={(event) =>
                              setRefinement(event.target.value)
                            }
                            value={refinement}
                          />
                          <PromptInputFooter>
                            <p className="text-xs text-muted-foreground">
                              Scoped to this PR branch.
                            </p>
                            <PromptInputSubmit disabled variant="outline">
                              Refinement API pending
                            </PromptInputSubmit>
                          </PromptInputFooter>
                        </PromptInput>
                      </MessageContent>
                    </Message>
                  ) : null}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            </CardContent>
          </Card>

          <Card className="min-h-0 overflow-hidden py-0">
            <div className="flex flex-wrap gap-2 border-b border-border p-3">
              {techTabs.map((tab) => (
                <Button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  size="sm"
                  variant={activeTab === tab.id ? "secondary" : "ghost"}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <CardContent className="max-h-[608px] overflow-auto p-4">
              <TechPanel activeTab={activeTab} detail={detail.data ?? null} />
            </CardContent>
          </Card>
        </section>
      ) : null}
    </DashboardShell>
  )
}

function TechPanel({
  activeTab,
  detail,
}: {
  activeTab: TechTab
  detail: FixRunDetail | null
}) {
  if (!detail) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a run to inspect technical detail.
      </p>
    )
  }

  if (activeTab === "diff") {
    const diffEvent = detail.events
      .slice()
      .reverse()
      .find((event) => event.type === "diff_summary")
    const diffPayload = diffEvent ? eventPayload(diffEvent) : null
    const patch =
      diffPayload && typeof diffPayload.patch === "string"
        ? diffPayload.patch
        : null
    const stat =
      diffPayload && typeof diffPayload.stat === "string"
        ? diffPayload.stat
        : null
    const nameStatus =
      diffPayload && typeof diffPayload.nameStatus === "string"
        ? diffPayload.nameStatus
        : null

    if (diffEvent) {
      return (
        <div className="grid gap-3">
          <div className="rounded-lg border border-border p-3">
            <h3 className="text-sm font-semibold">Changed files</h3>
            <pre className="mt-3 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-6">
              {nameStatus || "No changed files recorded."}
            </pre>
          </div>
          <div className="rounded-lg border border-border p-3">
            <h3 className="text-sm font-semibold">Diff stat</h3>
            <pre className="mt-3 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-6">
              {stat || "No diff stat recorded."}
            </pre>
          </div>
          <div className="rounded-lg border border-border p-3">
            <h3 className="text-sm font-semibold">Patch preview</h3>
            <pre className="mt-3 max-h-[420px] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-6">
              {patch || "No patch preview recorded."}
            </pre>
          </div>
        </div>
      )
    }

    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          The code diff appears here after the agent creates a commit. Until
          then, this tab shows the planned checks.
        </p>
        {detail.checks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checks yet.</p>
        ) : null}
        {detail.checks.map((check) => (
          <div
            className="rounded-lg border border-border p-3"
            key={check.rubricId}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm">{check.rubricId}</span>
              <Badge
                variant={
                  check.status === "FIXED"
                    ? "pass"
                    : check.status === "FAILED"
                      ? "fail"
                      : "muted"
                }
              >
                {check.status.toLowerCase()}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {check.note ?? `${check.category} check, ${check.scope}`}
            </p>
          </div>
        ))}
      </div>
    )
  }

  if (activeTab === "console") {
    return <EventList events={detail.events} />
  }

  if (activeTab === "logs") {
    return (
      <pre className="overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-6">
        {JSON.stringify(detail.events, null, 2)}
      </pre>
    )
  }

  return <TerminalPanel detail={detail} events={detail.events} />
}

function EventList({ events }: { events: RunEventView[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No events yet.</p>
  }

  return (
    <div className="grid gap-2">
      {events.map((event) => (
        <div
          className="grid grid-cols-[52px_120px_minmax(0,1fr)] gap-3 border-b border-border py-2 text-sm"
          key={event.seq}
        >
          <span className="font-mono text-xs text-muted-foreground">
            #{event.seq}
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {event.phase ?? "event"}
          </span>
          <span className="truncate">{event.type}</span>
        </div>
      ))}
    </div>
  )
}

function TerminalPanel({
  detail,
  events,
}: {
  detail: FixRunDetail
  events: RunEventView[]
}) {
  const commandEvents = events.filter((event) => {
    const command = commandFromEvent(event)
    const payload = eventPayload(event)
    return (
      !!command ||
      payload.toolName === "run_command" ||
      event.type === "branch_pushed" ||
      event.type.includes("push")
    )
  })

  return (
    <div className="grid gap-3">
      <pre className="overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-6">
        {`run=${detail.id}
state=${detail.state}
sandbox=${detail.sandboxStatus}
branch=${detail.branch ?? "pending"}
pr=${detail.prUrl ?? "pending"}
fixed=${detail.fixedChecks}/${detail.totalChecks}`}
      </pre>

      {commandEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Terminal commands will stream here when the agent emits tool-call
          events.
        </p>
      ) : null}

      {commandEvents.map((event) => {
        const payload = eventPayload(event)
        const command = commandFromEvent(event)
        const output =
          typeof payload.content === "string"
            ? payload.content
            : typeof payload.detail === "string"
              ? payload.detail
              : null

        return (
          <div className="rounded-lg border border-border p-3" key={event.seq}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                #{event.seq}
              </span>
              <Badge variant="muted">{event.type}</Badge>
            </div>
            <pre className="mt-3 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-6">
              {command ? `$ ${command}` : eventBody(event)}
              {output ? `\n\n${output}` : ""}
            </pre>
          </div>
        )
      })}
    </div>
  )
}
