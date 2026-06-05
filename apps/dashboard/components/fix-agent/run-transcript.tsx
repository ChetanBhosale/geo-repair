"use client"

import Link from "next/link"
import { Loader2 } from "lucide-react"
import type { FixRunDetail, FixRunSummary } from "@repo/types/fix"
import {
  eventBody,
  eventStatus,
  isActiveFixRun,
  stateLabel,
  stateVariant,
} from "@/lib/fix-run-view"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function RunTranscript({
  detail,
  isLoading,
  onRefinementChange,
  refinement,
  selectedRun,
}: {
  detail: FixRunDetail | null
  isLoading: boolean
  onRefinementChange: (message: string) => void
  refinement: string
  selectedRun: FixRunSummary
}) {
  const transcriptEvents =
    detail?.events.filter((event) => event.type !== "intake_submitted") ?? []
  const activeRun = isActiveFixRun(selectedRun.state)

  return (
    <Card className="min-h-0 overflow-hidden py-0">
      <CardHeader className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Agent chat log</CardTitle>
            <CardDescription>
              Read-only during the main run. Refinement opens after PR.
            </CardDescription>
          </div>
          <Badge variant={stateVariant(selectedRun.state)}>
            {activeRun ? <Loader2 className="size-3 animate-spin" /> : null}
            {stateLabel(selectedRun.state)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-[540px] p-0">
        <Conversation>
          <ConversationContent>
            {isLoading ? (
              <ConversationEmptyState
                title="Loading run transcript"
                description="Fetching events, checks, and PR state."
                icon={<Loader2 className="size-4 animate-spin" />}
              />
            ) : null}

            {detail?.intake ? (
              <Message className="bg-secondary/30" from="user">
                <MessageContent className="bg-transparent p-0">
                  <h3 className="text-sm font-medium">Clarification answers</h3>
                  <div className="grid gap-2">
                    {detail.intake.answers.map((answer) => (
                      <div
                        className="rounded-md bg-primary px-3 py-2 text-sm"
                        key={answer.questionId}
                      >
                        <p className="font-medium">{answer.question}</p>
                        <p className="mt-1 text-secondary">
                          {answer.answerLabel}
                        </p>
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
            ) : null}

            {detail && transcriptEvents.length === 0 ? (
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
                <MessageContent className="bg-transparent p-0">
                  <div className="flex items-center justify-between gap-2 font-mono text-xs tracking-wide text-secondary uppercase">
                    <span>#{event.seq}</span>
                    <span>{event.phase ?? event.type}</span>
                  </div>
                  <h3 className="text-sm font-medium">{event.type}</h3>
                  <MessageResponse>{eventBody(event)}</MessageResponse>
                </MessageContent>
              </Message>
            ))}

            {detail?.state === "PR_OPENED" || detail?.state === "COMPLETED" ? (
              <Message className="bg-success/5" from="assistant">
                <MessageContent className="bg-transparent p-0">
                  <h3 className="text-sm font-medium">Refine this PR</h3>
                  <MessageResponse>
                    Post-PR Refinement Mode is the only place users can
                    free-form chat. The backend endpoint is still pending, so
                    this composer is staged as UI only.
                  </MessageResponse>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                      <Link href="/reports">Generate reports</Link>
                    </Button>
                    {selectedRun.prUrl ? (
                      <Button asChild variant="outline">
                        <a
                          href={selectedRun.prUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open PR
                        </a>
                      </Button>
                    ) : null}
                  </div>
                  <PromptInput
                    onSubmit={(message) => onRefinementChange(message.text)}
                  >
                    <PromptInputTextarea
                      aria-label="Refinement request"
                      onChange={(event) =>
                        onRefinementChange(event.target.value)
                      }
                      value={refinement}
                    />
                    <PromptInputFooter>
                      <p className="text-xs text-secondary">
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
  )
}
