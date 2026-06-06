"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUp,
  Box,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileDiff,
  GitBranch,
  GitPullRequest,
  Info,
  ListChecks,
  Loader2,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react"
import type { FixRunDetail, FixRunIntake, FixRunSummary } from "@repo/types/fix"
import { useSubmitFixIntake } from "@/hooks/use-fix"
import { buildIntake, latestClarificationRequest } from "@/lib/fix-intake"
import {
  buildTranscript,
  type SeparatorItem,
  type SystemIcon,
  type SystemItem,
  type TranscriptItem,
} from "@/lib/fix-run-chat"
import { isActiveFixRun, stateLabel, stateVariant } from "@/lib/fix-run-view"
import type { ArtifactTab } from "@/lib/fix-run-view"
import { ClarificationCard } from "@/components/fix-agent/clarification-card"
import { ToolCall } from "@/components/fix-agent/tool-call"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function RunChat({
  detail,
  isLoading,
  selectedRun,
  onFocusArtifact,
  onNewRun,
}: {
  detail: FixRunDetail | null
  isLoading: boolean
  selectedRun: FixRunSummary
  onFocusArtifact: (tab: ArtifactTab) => void
  onNewRun: () => void
}) {
  const activeRun = isActiveFixRun(selectedRun.state)
  const clarificationRequest = latestClarificationRequest(detail)
  const needsClarification = !!clarificationRequest && !detail?.intake
  const submitIntake = useSubmitFixIntake(selectedRun.id)

  const items = detail
    ? buildTranscript(detail.events, { runActive: activeRun })
    : []
  // Split the transcript at the planning→fixing seam so the clarification gate
  // (the questions form + the user's answers) sits exactly between the passes.
  const fixingIdx = items.findIndex(
    (item) => item.kind === "separator" && item.index === 2
  )
  const head = fixingIdx === -1 ? items : items.slice(0, fixingIdx)
  const tail = fixingIdx === -1 ? [] : items.slice(fixingIdx)
  const onlyPlanningSeparator =
    !!detail && items.length <= 1 && !needsClarification

  function renderItem(item: TranscriptItem) {
    const key =
      item.kind === "separator"
        ? `sep-${item.index}`
        : `${item.kind}-${item.seq}`

    if (item.kind === "separator") {
      return <Separator item={item} key={key} state={selectedRun.state} />
    }
    if (item.kind === "assistant") {
      return (
        <Message from="assistant" key={key}>
          <MessageContent className="my-4 p-0">
            <MessageResponse className="text-primary">
              {item.text}
            </MessageResponse>
          </MessageContent>
        </Message>
      )
    }
    if (item.kind === "tool") {
      return <ToolCall item={item} key={key} runActive={activeRun} />
    }
    return <SystemRow item={item} key={key} onFocusArtifact={onFocusArtifact} />
  }

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 py-0">
      <CardHeader className="shrink-0 border-b border-secondary py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Agent</CardTitle>
          <Badge variant={stateVariant(selectedRun.state)}>
            {activeRun ? <Loader2 className="size-3 animate-spin" /> : null}
            {stateLabel(selectedRun.state)}
          </Badge>
        </div>
      </CardHeader>
      <div className="flex min-h-0 flex-1 flex-col">
        <Conversation>
          <ConversationContent>
            {isLoading && !detail ? (
              <ConversationEmptyState
                description="Fetching the agent transcript, checks, and PR state."
                icon={<Loader2 className="size-4 animate-spin" />}
                title="Loading run"
              />
            ) : null}

            {head.map(renderItem)}

            {onlyPlanningSeparator ? (
              <p className="px-1 text-xs text-secondary">
                {activeRun
                  ? "Waiting for the agent to start inspecting…"
                  : "No agent activity was recorded for this run."}
              </p>
            ) : null}

            {/* Planning agent's summary lands in the conversation; the actual
                questions dock above the chat input below. */}
            {clarificationRequest ? (
              <Message from="assistant">
                <MessageContent className="bg-secondary">
                  <MessageResponse className="text-primary">
                    {clarificationRequest.summary}
                  </MessageResponse>
                </MessageContent>
              </Message>
            ) : null}

            {detail?.intake ? <IntakeAnswers intake={detail.intake} /> : null}

            {tail.map(renderItem)}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>
      {needsClarification && clarificationRequest ? (
        <div className="shrink-0 border-t border-secondary p-3">
          <ClarificationCard
            error={submitIntake.error?.message ?? null}
            isPending={submitIntake.isPending}
            onSubmit={(answers, notes) =>
              submitIntake.mutate(
                buildIntake(clarificationRequest, answers, notes)
              )
            }
            request={clarificationRequest}
          />
        </div>
      ) : null}
      <ChatComposer
        onNewRun={onNewRun}
        prUrl={selectedRun.prUrl}
        state={selectedRun.state}
      />
    </Card>
  )
}

function Separator({
  item,
  state,
}: {
  item: SeparatorItem
  state: FixRunSummary["state"]
}) {
  const waiting = item.pass === "planning" && state === "WAITING_FOR_INPUT"
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-secondary" />
      <div className="flex items-center gap-2">
        <span className="grid size-5 place-items-center rounded-full bg-secondary text-[10px] font-semibold">
          {item.index}
        </span>
        <span className="text-xs font-semibold tracking-wide uppercase">
          {item.label}
        </span>
        {item.sublabel ? (
          <span className="text-xs text-secondary">· {item.sublabel}</span>
        ) : null}
        {waiting ? (
          <span className="text-xs text-secondary">· waiting for you</span>
        ) : item.status === "active" ? (
          <Loader2 className="size-3.5 animate-spin text-secondary" />
        ) : (
          <Check className="size-3.5 text-success" />
        )}
      </div>
      <div className="h-px flex-1 bg-secondary" />
    </div>
  )
}

function SystemRow({
  item,
  onFocusArtifact,
}: {
  item: SystemItem
  onFocusArtifact: (tab: ArtifactTab) => void
}) {
  const [open, setOpen] = React.useState(false)
  const tone =
    item.tone === "success"
      ? "text-success"
      : item.tone === "danger"
        ? "text-danger"
        : "text-secondary"
  const hasSubsteps = !!item.substeps?.length

  return (
    <div className="px-2 py-0.5 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {hasSubsteps ? (
          <button
            aria-expanded={open}
            className="flex items-center gap-2 text-left"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            <SystemGlyph
              className={cn("size-3.5 shrink-0", tone)}
              icon={item.icon}
            />
            <span>{item.label}</span>
            <ChevronRight
              className={cn(
                "size-3 text-tertiary transition-transform",
                open && "rotate-90"
              )}
            />
          </button>
        ) : (
          <>
            <SystemGlyph
              className={cn("size-3.5 shrink-0", tone)}
              icon={item.icon}
            />
            <span className={cn(item.tone === "danger" && "text-danger")}>
              {item.label}
            </span>
          </>
        )}
        {item.artifact ? (
          <Button
            className="h-auto p-0"
            onClick={() => onFocusArtifact(item.artifact!)}
            size="xs"
            variant="link"
          >
            See {item.artifact === "diff" ? "Diff" : "Checks"} tab →
          </Button>
        ) : item.detail ? (
          <span className="text-secondary">— {item.detail}</span>
        ) : null}
        {item.href ? (
          <a
            className="inline-flex items-center gap-1 text-brand underline-offset-4 hover:underline"
            href={item.href}
            rel="noreferrer"
            target="_blank"
          >
            Open <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>
      {hasSubsteps && open ? (
        <ul className="mt-1 ml-5 grid gap-0.5 border-l border-secondary pl-3 text-secondary">
          {item.substeps!.map((step, stepIndex) => (
            <li key={stepIndex}>{step}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function IntakeAnswers({ intake }: { intake: FixRunIntake }) {
  return (
    <Message from="user">
      <MessageContent className="bg-secondary">
        <h3 className="text-sm font-medium">Your answers</h3>
        <div className="grid gap-2">
          {intake.answers.map((answer) => (
            <div
              className="rounded-md bg-primary px-3 py-2 text-sm"
              key={answer.questionId}
            >
              <p className="font-medium">{answer.question}</p>
              <p className="mt-1 text-secondary">{answer.answerLabel}</p>
              {answer.notes ? (
                <p className="mt-1 text-xs text-secondary">
                  Note: {answer.notes}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </MessageContent>
    </Message>
  )
}

// Sticky chat composer at the bottom of the pane. Enabled only once the run is
// done (post-PR refinement); a failed run swaps it for a recovery CTA; disabled
// with a stage-appropriate hint otherwise.
function ChatComposer({
  state,
  prUrl,
  onNewRun,
}: {
  state: FixRunSummary["state"]
  prUrl: string | null
  onNewRun: () => void
}) {
  const [text, setText] = React.useState("")
  const [note, setNote] = React.useState<string | null>(null)

  if (state === "FAILED") {
    return (
      <div className="shrink-0 border-t border-secondary bg-primary p-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-danger/10 px-3 py-2.5">
          <p className="text-sm text-danger">
            This run failed. Start a new run to try again.
          </p>
          <Button onClick={onNewRun} size="sm">
            <RotateCcw className="size-4" />
            Start a new run
          </Button>
        </div>
      </div>
    )
  }

  const enabled = state === "PR_OPENED" || state === "COMPLETED"
  const placeholder = enabled
    ? "Ask for a follow-up tweak to this PR…"
    : state === "WAITING_FOR_INPUT"
      ? "Answer the questions above to continue…"
      : "The agent is working — chat opens when the run finishes…"

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!enabled || !text.trim()) return
    setNote("Follow-up refinement is coming soon — it isn't wired up yet.")
  }

  return (
    <div className="shrink-0 border-t border-secondary bg-primary p-3">
      {enabled ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
          <Badge variant="neutral">Refine</Badge>
          <Button asChild className="h-auto p-0" size="xs" variant="link">
            <Link href="/reports">Generate reports</Link>
          </Button>
          {prUrl ? (
            <Button asChild className="h-auto p-0" size="xs" variant="link">
              <a href={prUrl} rel="noreferrer" target="_blank">
                Open PR
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}
      {note ? <p className="mb-2 px-1 text-xs text-secondary">{note}</p> : null}
      <form
        className="flex items-end gap-2 rounded-xl bg-secondary/50 p-2 focus-within:ring-3 focus-within:ring-focus/30"
        onSubmit={onSubmit}
      >
        <textarea
          aria-label="Message the agent"
          className="max-h-32 min-h-8 w-full resize-none bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-secondary disabled:cursor-not-allowed"
          disabled={!enabled}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          rows={1}
          value={text}
        />
        <Button
          aria-label="Send"
          disabled={!enabled || !text.trim()}
          size="icon-sm"
          type="submit"
        >
          <ArrowUp className="size-4" />
        </Button>
      </form>
    </div>
  )
}

function SystemGlyph({
  icon,
  className,
}: {
  icon: SystemIcon
  className?: string
}) {
  switch (icon) {
    case "scan":
      return <Search className={className} />
    case "plan":
      return <ListChecks className={className} />
    case "sandbox":
      return <Box className={className} />
    case "clone":
      return <GitBranch className={className} />
    case "diff":
      return <FileDiff className={className} />
    case "push":
      return <Upload className={className} />
    case "pr":
      return <GitPullRequest className={className} />
    case "done":
      return <CheckCircle2 className={className} />
    case "error":
      return <AlertTriangle className={className} />
    default:
      return <Info className={className} />
  }
}
