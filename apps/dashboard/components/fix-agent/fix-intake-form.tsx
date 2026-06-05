"use client"

import type * as React from "react"
import { Loader2, Play } from "lucide-react"
import type { FixIntakeQuestionId } from "@repo/types/fix"
import type { IntakeAnswers, IntakeNotes } from "@/lib/fix-intake"
import { intakeQuestions } from "@/lib/fix-intake"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function FixIntakeForm({
  error,
  intakeAnswers,
  intakeNotes,
  isPending,
  onAnswerChange,
  onNoteChange,
  onSubmit,
  onWebsiteChange,
  selectedRepoFullName,
  website,
}: {
  error: Error | null
  intakeAnswers: IntakeAnswers
  intakeNotes: IntakeNotes
  isPending: boolean
  onAnswerChange: (questionId: FixIntakeQuestionId, answerId: string) => void
  onNoteChange: (questionId: FixIntakeQuestionId, note: string) => void
  onSubmit: (event: React.FormEvent) => void
  onWebsiteChange: (website: string) => void
  selectedRepoFullName: string
  website: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a fix run</CardTitle>
        <CardDescription>
          Confirm the website for {selectedRepoFullName}. The backend creates a
          fix run and starts the Temporal workflow.
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
                  const selected = intakeAnswers[question.id] === option.id

                  return (
                    <button
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors",
                        selected
                          ? "border-foreground bg-background"
                          : "border-border bg-background/70 hover:bg-muted"
                      )}
                      key={option.id}
                      onClick={() => onAnswerChange(question.id, option.id)}
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
                  onNoteChange(question.id, event.target.value)
                }
                placeholder={question.notePlaceholder}
                value={intakeNotes[question.id] ?? ""}
              />
            </fieldset>
          ))}
        </div>

        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSubmit}>
          <Input
            disabled={isPending}
            inputMode="url"
            onChange={(event) => onWebsiteChange(event.target.value)}
            placeholder="https://example.com"
            type="text"
            value={website}
          />
          <Button disabled={!website.trim() || isPending} type="submit">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Start fix
          </Button>
        </form>
        {error ? (
          <p className="mt-3 text-sm text-destructive">{error.message}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
