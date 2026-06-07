"use client"

import * as React from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import type { FixTier, PlanSummary } from "@repo/types/billing"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type SelfServeFixTier = Exclude<FixTier, "ENTERPRISE_CUSTOM">

function selfServeTier(plan: PlanSummary): SelfServeFixTier | null {
  return plan.selfServe && plan.tier !== "ENTERPRISE_CUSTOM"
    ? (plan.tier as SelfServeFixTier)
    : null
}

function formatPrice(plan: PlanSummary): string {
  if (!plan.selfServe || plan.amountCents <= 0) return "Custom"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(plan.amountCents / 100)
}

// The applicable plan is the cheapest (lowest sortOrder) plan whose page bound
// covers the scan. Unbounded plans (maxPages null) always cover.
function applicablePlanFor(
  plans: PlanSummary[],
  pageCount: number
): PlanSummary | null {
  const sorted = [...plans].sort((a, b) => a.sortOrder - b.sortOrder)
  return sorted.find((p) => p.maxPages === null || pageCount <= p.maxPages) ?? null
}

type FixTierCheckoutDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageCount: number
  plans: PlanSummary[]
  pending: boolean
  error?: Error | null
  onCheckout: (tier: SelfServeFixTier) => void
}

export function FixTierCheckoutDialog({
  open,
  onOpenChange,
  pageCount,
  plans,
  pending,
  error,
  onCheckout,
}: FixTierCheckoutDialogProps) {
  const normalizedPageCount = Math.max(1, Math.round(pageCount))
  const sortedPlans = React.useMemo(
    () => [...plans].sort((a, b) => a.sortOrder - b.sortOrder),
    [plans]
  )
  const applicablePlan = applicablePlanFor(sortedPlans, normalizedPageCount)
  const applicableRank = applicablePlan?.sortOrder ?? 0
  const defaultSelectedTier = applicablePlan
    ? selfServeTier(applicablePlan)
    : null

  const [selectedTier, setSelectedTier] =
    React.useState<SelfServeFixTier | null>(null)

  const selectedPlan = selectedTier
    ? sortedPlans.find((p) => p.tier === selectedTier)
    : undefined
  const effectiveSelectedTier =
    selectedPlan && selectedPlan.sortOrder >= applicableRank
      ? selectedTier
      : defaultSelectedTier

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedTier(null)
    }
    onOpenChange(nextOpen)
  }

  const canCheckout = Boolean(effectiveSelectedTier) && !pending
  const noSelfServe = applicablePlan ? !applicablePlan.selfServe : false

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose your AI Search Fix tier</DialogTitle>
          <DialogDescription>
            This scan checked {normalizedPageCount} page
            {normalizedPageCount === 1 ? "" : "s"}.{" "}
            {applicablePlan ? (
              <>
                The applicable tier is {applicablePlan.name}. You can choose a
                larger tier, but not a smaller one.
              </>
            ) : (
              <>Plans are unavailable right now. Please try again shortly.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 overflow-y-auto px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          {sortedPlans.map((plan) => {
            const selfServeId = selfServeTier(plan)
            const isApplicable = plan.tier === applicablePlan?.tier
            const isLower = plan.sortOrder < applicableRank
            const isSelfServe = Boolean(selfServeId)
            const isDisabled = isLower || !isSelfServe
            const isSelected = plan.tier === effectiveSelectedTier

            return (
              <button
                key={plan.id}
                aria-pressed={isSelected}
                className={cn(
                  "flex min-h-56 flex-col gap-4 rounded-lg border border-primary bg-primary p-4 text-left transition hover:border-brand disabled:cursor-not-allowed disabled:opacity-55",
                  isSelected && "border-brand ring-1 ring-brand/30",
                  isLower && "bg-secondary"
                )}
                disabled={isDisabled || pending}
                onClick={() => {
                  if (selfServeId) {
                    setSelectedTier(selfServeId)
                  }
                }}
                type="button"
              >
                <span className="flex items-start justify-between gap-2">
                  <span>
                    <span className="block text-sm font-semibold">
                      {plan.name}
                    </span>
                    <span className="mt-1 block text-xs text-secondary">
                      {plan.pageCover ??
                        (plan.maxPages
                          ? `Up to ${plan.maxPages} pages`
                          : "Custom scope")}
                    </span>
                  </span>
                  {isSelected ? (
                    <CheckCircle2 className="size-4 text-brand" />
                  ) : null}
                </span>

                <span className="text-2xl font-semibold">
                  {formatPrice(plan)}
                </span>
                <span className="text-sm text-secondary">
                  {plan.description ?? ""}
                </span>

                <span className="mt-auto">
                  {isApplicable ? (
                    <Badge>Applicable tier</Badge>
                  ) : isLower ? (
                    <Badge variant="neutral">Too small</Badge>
                  ) : !isSelfServe ? (
                    <Badge variant="neutral">Manual scope</Badge>
                  ) : (
                    <Badge variant="neutral">Optional upgrade</Badge>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <div className="grid gap-2 px-5 pb-4">
          <p className="text-sm text-secondary">
            Card details are handled securely. The fix starts only after payment
            clears.
          </p>
          {noSelfServe ? (
            <p className="text-sm text-danger">
              This scan is above the self-serve checkout limit. Contact support
              for a custom quote.
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-danger">{error.message}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!canCheckout}
            onClick={() => {
              if (effectiveSelectedTier) {
                onCheckout(effectiveSelectedTier)
              }
            }}
            type="button"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Continue to payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
