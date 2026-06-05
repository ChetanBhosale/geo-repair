"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Info, Loader2 } from "lucide-react"
import type { FixClarificationRequest } from "@repo/types/fix"
import type { IntakeAnswers, IntakeNotes } from "@/lib/fix-intake"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Codex-style clarification: one question at a time, numbered options with an
// info icon that reveals a short description on hover, and a pager.
export function ClarificationCard({
  request,
  isPending,
  error,
  onSubmit,
}: {
  request: FixClarificationRequest
  isPending: boolean
  error: string | null
  onSubmit: (answers: IntakeAnswers, notes: IntakeNotes) => void
}) {
  const [index, setIndex] = React.useState(0)
  const [answers, setAnswers] = React.useState<IntakeAnswers>(() =>
    Object.fromEntries(
      request.questions.map((q) => [
        q.id,
        (q.options.find((o) => isRecommended(o.label)) ?? q.options[0])?.id ??
          "",
      ]),
    ),
  )
  const [notes, setNotes] = React.useState<IntakeNotes>({})
  const [noteOpen, setNoteOpen] = React.useState<Record<string, boolean>>({})

  const total = request.questions.length
  const question = request.questions[index]
  const isLast = index === total - 1

  if (!question) return null

  function go(delta: number) {
    setIndex((i) => Math.min(total - 1, Math.max(0, i + delta)))
  }

  function onContinue() {
    if (isPending) return
    if (isLast) onSubmit(answers, notes)
    else go(1)
  }

  return (
    <div className="rounded-xl bg-secondary/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium">{question.question}</h3>
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-secondary">
          <button
            aria-label="Previous question"
            className="grid size-5 place-items-center rounded hover:bg-secondary disabled:opacity-40"
            disabled={index === 0}
            onClick={() => go(-1)}
            type="button"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span>
            {index + 1} of {total}
          </span>
          <button
            aria-label="Next question"
            className="grid size-5 place-items-center rounded hover:bg-secondary disabled:opacity-40"
            disabled={isLast}
            onClick={() => go(1)}
            type="button"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-1">
        {question.options.map((option, optionIndex) => {
          const selected = answers[question.id] === option.id
          const recommended = isRecommended(option.label)
          return (
            <button
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                selected ? "bg-secondary" : "hover:bg-secondary/60",
              )}
              key={option.id}
              onClick={() =>
                setAnswers((current) => ({
                  ...current,
                  [question.id]: option.id,
                }))
              }
              type="button"
            >
              <span className="w-3.5 shrink-0 text-secondary">
                {optionIndex + 1}
              </span>
              {recommended ? (
                <Badge className="shrink-0" variant="pass">
                  Recommended
                </Badge>
              ) : null}
              <span className="min-w-0 flex-1">{cleanLabel(option.label)}</span>
              <InfoHint text={option.description} />
            </button>
          )
        })}
      </div>

      <div className="mt-2">
        {noteOpen[question.id] ? (
          <textarea
            aria-label="Add a note"
            className="min-h-14 w-full resize-y rounded-lg bg-secondary/50 px-3 py-2 text-sm outline-none placeholder:text-secondary focus-visible:bg-primary focus-visible:ring-3 focus-visible:ring-focus/40"
            onChange={(event) =>
              setNotes((current) => ({
                ...current,
                [question.id]: event.target.value,
              }))
            }
            placeholder={question.notePlaceholder}
            value={notes[question.id] ?? ""}
          />
        ) : (
          <button
            className="text-xs text-secondary hover:text-primary"
            onClick={() =>
              setNoteOpen((current) => ({ ...current, [question.id]: true }))
            }
            type="button"
          >
            + Add a note
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-secondary">
          {isLast
            ? "Last question"
            : `${total - index - 1} more question${total - index - 1 === 1 ? "" : "s"}`}
        </p>
        <Button disabled={isPending} onClick={onContinue} size="sm">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {isLast ? "Submit answers" : "Continue"}
        </Button>
      </div>

      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  )
}

function InfoHint({ text }: { text: string }) {
  return (
    <span
      className="group/hint relative inline-flex shrink-0 cursor-help"
      tabIndex={0}
    >
      <Info className="size-3.5 text-tertiary" />
      <span className="pointer-events-none absolute right-0 bottom-full z-10 mb-1.5 hidden w-64 rounded-md bg-tertiary p-2.5 text-xs leading-5 text-primary shadow-lg group-hover/hint:block group-focus/hint:block">
        {firstTwoSentences(text)}
      </span>
    </span>
  )
}

function firstTwoSentences(text: string): string {
  const parts = text.trim().split(/(?<=[.!?])\s+/)
  return parts.slice(0, 2).join(" ")
}

// The planner flags its suggested default by starting the label with
// "Recommended:". We surface that as a badge and strip it from the shown label.
function isRecommended(label: string): boolean {
  return /^\s*recommended\b/i.test(label)
}

function cleanLabel(label: string): string {
  return label.replace(/^\s*recommended\s*[:\-–—]?\s*/i, "").trim() || label
}
