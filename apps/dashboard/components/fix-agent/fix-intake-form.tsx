"use client"

import type * as React from "react"
import { CreditCard, Loader2, Play } from "lucide-react"
import type { BillingOrder } from "@repo/types/billing"
import type { FixIntakeQuestionId } from "@repo/types/fix"
import type { IntakeAnswers, IntakeNotes } from "@/lib/fix-intake"
import { intakeQuestions } from "@/lib/fix-intake"
import { formatMoney } from "@/lib/dashboard-format"
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
  paidOrders,
  selectedOrderId,
  onOrderChange,
  selectedRepoFullName,
  website,
  websiteDisabled,
}: {
  error: Error | null
  intakeAnswers: IntakeAnswers
  intakeNotes: IntakeNotes
  isPending: boolean
  onAnswerChange: (questionId: FixIntakeQuestionId, answerId: string) => void
  onNoteChange: (questionId: FixIntakeQuestionId, note: string) => void
  onOrderChange: (orderId: string | null) => void
  onSubmit: (event: React.FormEvent) => void
  onWebsiteChange: (website: string) => void
  paidOrders: BillingOrder[]
  selectedOrderId: string | null
  selectedRepoFullName: string
  website: string
  websiteDisabled: boolean
}) {
  const selectedOrder = paidOrders.find((order) => order.id === selectedOrderId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a fix run</CardTitle>
        <CardDescription>
          Select the paid order for {selectedRepoFullName}. The backend
          verifies it before starting the Temporal workflow.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Paid order</h2>
          </div>
          {paidOrders.length > 0 ? (
            <>
              <select
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={isPending}
                onChange={(event) =>
                  onOrderChange(event.target.value.trim() || null)
                }
                value={selectedOrderId ?? ""}
              >
                <option disabled value="">
                  Choose a paid order
                </option>
                {paidOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.website} · {formatMoney(order.amountCents, order.currency)}
                  </option>
                ))}
              </select>
              {selectedOrder ? (
                <p className="text-xs text-muted-foreground">
                  Order {selectedOrder.id} is paid and scoped to{" "}
                  {selectedOrder.repoFullName ?? selectedRepoFullName}.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Run a website scan, select this repository, and complete checkout
              before starting the fix agent.
            </p>
          )}
        </div>

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
            disabled={isPending || websiteDisabled}
            inputMode="url"
            onChange={(event) => onWebsiteChange(event.target.value)}
            placeholder="https://example.com"
            type="text"
            value={website}
          />
          <Button
            disabled={!website.trim() || !selectedOrderId || isPending}
            type="submit"
          >
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
