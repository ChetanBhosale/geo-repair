"use client"

import * as React from "react"
import { CheckIcon, SpinnerGapIcon } from "@phosphor-icons/react"
import type { FixTier, PlanSummary } from "@repo/types/billing"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useBillingPlans } from "@/query/billing.query"

type FixPlanDialogProps = {
  open: boolean
  pageCount: number
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onContinue: (tier: FixTier) => void
}

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountCents / 100)
}

function PageCoverageGraphic({
  level,
  total,
  selected,
}: {
  level: number
  total: number
  selected: boolean
}) {
  return (
    <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => {
        const filled = index < level
        return (
          <span
            key={index}
            className={cn(
              "relative h-5 w-4 overflow-hidden",
              filled
                ? selected
                  ? "bg-primary-foreground"
                  : "bg-primary"
                : selected
                  ? "bg-primary-foreground/20"
                  : "bg-muted-foreground/20"
            )}
          >
            <span
              className={cn(
                "absolute top-0 right-0 size-1.5",
                selected ? "bg-primary" : "bg-card"
              )}
            />
          </span>
        )
      })}
    </span>
  )
}

function requiredPlanForPageCount(
  plans: PlanSummary[],
  pageCount: number
): PlanSummary | null {
  return (
    plans.find((plan) => plan.maxPages !== null && pageCount <= plan.maxPages) ??
    plans.find((plan) => !plan.selfServe) ??
    null
  )
}

export function FixPlanDialog({
  open,
  pageCount,
  pending = false,
  onOpenChange,
  onContinue,
}: FixPlanDialogProps) {
  const plans = useBillingPlans()
  const sortedPlans = React.useMemo(
    () => [...(plans.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [plans.data]
  )
  const selfServePlans = React.useMemo(
    () => sortedPlans.filter((plan) => plan.selfServe),
    [sortedPlans]
  )
  const requiredPlan = requiredPlanForPageCount(sortedPlans, pageCount)
  const requiredSelfServePlan = requiredPlan?.selfServe ? requiredPlan : null
  const [selectedTier, setSelectedTier] = React.useState<FixTier | null>(null)

  const explicitPlan =
    selfServePlans.find((plan) => plan.tier === selectedTier) ?? null
  const explicitPlanAllowed = Boolean(
    explicitPlan &&
      requiredSelfServePlan &&
      explicitPlan.selfServe &&
      explicitPlan.sortOrder >= requiredSelfServePlan.sortOrder
  )
  const selectedPlan = explicitPlanAllowed ? explicitPlan : requiredSelfServePlan
  const canContinue = !!selectedPlan && !pending
  const isAboveSelfServe = requiredPlan != null && !requiredPlan.selfServe
  const maxSelfServePages =
    selfServePlans.at(-1)?.maxPages ?? requiredSelfServePlan?.maxPages ?? null

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setSelectedTier(null)
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-6 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose your fix plan</DialogTitle>
          <DialogDescription>
            {pageCount} {pageCount === 1 ? "page" : "pages"} scanned. Lower
            plans are unavailable for this site.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-3">
          {plans.isLoading && selfServePlans.length === 0
            ? Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="min-h-36 animate-pulse bg-muted" />
              ))
            : selfServePlans.map((plan) => {
                const isSelected = plan.tier === selectedPlan?.tier
                const coverageLevel =
                  selfServePlans.findIndex((item) => item.tier === plan.tier) +
                  1
                const isLower =
                  requiredSelfServePlan != null &&
                  plan.sortOrder < requiredSelfServePlan.sortOrder
                const disabled =
                  !requiredSelfServePlan ||
                  isAboveSelfServe ||
                  isLower ||
                  pending

                return (
                  <button
                    key={plan.tier}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={disabled}
                    onClick={() => setSelectedTier(plan.tier)}
                    className={cn(
                      "relative flex min-h-64 cursor-pointer flex-col overflow-hidden bg-secondary p-4 text-left text-secondary-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold">{plan.name}</p>
                      </div>
                      {isSelected ? (
                        <span className="flex size-6 shrink-0 items-center justify-center bg-primary-foreground/15">
                          <CheckIcon className="size-4" />
                        </span>
                      ) : null}
                    </div>

                    <p
                      className={cn(
                        "mt-4 flex items-center justify-between gap-3 bg-card px-3 py-2 text-sm font-semibold",
                        isSelected
                          ? "bg-primary-foreground/15 text-primary-foreground"
                          : "text-foreground"
                      )}
                    >
                      <span>{plan.pageCover}</span>
                      <PageCoverageGraphic
                        level={coverageLevel}
                        total={selfServePlans.length}
                        selected={isSelected}
                      />
                    </p>

                    <div className="py-5">
                      <p className="text-2xl font-semibold tracking-tight">
                        {formatMoney(plan.amountCents, plan.currency)}
                      </p>
                      {plan.description ? (
                        <p
                          className={cn(
                            "mt-2 text-xs/relaxed",
                            isSelected
                              ? "text-primary-foreground/75"
                              : "text-muted-foreground"
                          )}
                        >
                          {plan.description}
                        </p>
                      ) : null}
                      {plan.features.length > 0 ? (
                        <ul
                          className={cn(
                            "mt-4 space-y-1.5 text-xs/relaxed",
                            isSelected
                              ? "text-primary-foreground/80"
                              : "text-muted-foreground"
                          )}
                        >
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex gap-2">
                              <span
                                className={cn(
                                  "mt-1.5 size-1 shrink-0",
                                  isSelected
                                    ? "bg-primary-foreground"
                                    : "bg-primary"
                                )}
                              />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </button>
                )
              })}
        </div>

        {isAboveSelfServe ? (
          <div className="bg-secondary px-4 py-3 text-sm text-muted-foreground">
            Self-serve checkout covers up to {maxSelfServePages ?? 250} pages.
          </div>
        ) : selectedPlan ? (
          <div className="bg-secondary px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Selected plan</span>
              <span className="font-semibold">
                {selectedPlan.name} ·{" "}
                {formatMoney(selectedPlan.amountCents, selectedPlan.currency)}
              </span>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canContinue}
            onClick={() => selectedPlan && onContinue(selectedPlan.tier)}
          >
            {pending ? <SpinnerGapIcon className="size-4 animate-spin" /> : null}
            Make Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
