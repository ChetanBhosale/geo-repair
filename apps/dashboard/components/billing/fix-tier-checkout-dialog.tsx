"use client"

import * as React from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import type { FixTier } from "@repo/types/billing"

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

type TierOption = {
  id: FixTier
  name: string
  pages: string
  price: string
  description: string
}

const TIER_RANK: Record<FixTier, number> = {
  STARTER: 0,
  GROWTH: 1,
  SCALE: 2,
  ENTERPRISE_CUSTOM: 3,
}

const TIER_OPTIONS: TierOption[] = [
  {
    id: "STARTER",
    name: "Starter",
    pages: "Up to 25 pages",
    price: "$49",
    description: "Best for a compact site or early launch.",
  },
  {
    id: "GROWTH",
    name: "Growth",
    pages: "Up to 100 pages",
    price: "$149",
    description: "Best for a normal marketing site with key service pages.",
  },
  {
    id: "SCALE",
    name: "Scale",
    pages: "Up to 250 pages",
    price: "$399",
    description: "Best for larger content libraries and multi-page sites.",
  },
  {
    id: "ENTERPRISE_CUSTOM",
    name: "Enterprise",
    pages: "250+ pages",
    price: "Custom",
    description: "For sites that need manual scoping before checkout.",
  },
]

function applicableTierForPageCount(pageCount: number): FixTier {
  if (pageCount <= 25) return "STARTER"
  if (pageCount <= 100) return "GROWTH"
  if (pageCount <= 250) return "SCALE"
  return "ENTERPRISE_CUSTOM"
}

function selfServeTier(value: FixTier): SelfServeFixTier | null {
  return value === "ENTERPRISE_CUSTOM" ? null : value
}

function tierLabel(value: FixTier) {
  return TIER_OPTIONS.find((tier) => tier.id === value)?.name ?? value
}

type FixTierCheckoutDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageCount: number
  pending: boolean
  error?: Error | null
  onCheckout: (tier: SelfServeFixTier) => void
}

export function FixTierCheckoutDialog({
  open,
  onOpenChange,
  pageCount,
  pending,
  error,
  onCheckout,
}: FixTierCheckoutDialogProps) {
  const normalizedPageCount = Math.max(1, Math.round(pageCount))
  const applicableTier = applicableTierForPageCount(normalizedPageCount)
  const defaultSelectedTier = selfServeTier(applicableTier)
  const [selectedTier, setSelectedTier] =
    React.useState<SelfServeFixTier | null>(null)
  const effectiveSelectedTier =
    selectedTier && TIER_RANK[selectedTier] >= TIER_RANK[applicableTier]
      ? selectedTier
      : defaultSelectedTier

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedTier(null)
    }
    onOpenChange(nextOpen)
  }

  const canCheckout = Boolean(effectiveSelectedTier) && !pending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose your AI Search Fix tier</DialogTitle>
          <DialogDescription>
            This scan checked {normalizedPageCount} page
            {normalizedPageCount === 1 ? "" : "s"}. The applicable tier is{" "}
            {tierLabel(applicableTier)}. You can choose a larger tier, but not a
            smaller one.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 overflow-y-auto px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIER_OPTIONS.map((tier) => {
            const selfServeId = selfServeTier(tier.id)
            const isApplicable = tier.id === applicableTier
            const isLower = TIER_RANK[tier.id] < TIER_RANK[applicableTier]
            const isSelfServe = Boolean(selfServeId)
            const isDisabled = isLower || !isSelfServe
            const isSelected = tier.id === effectiveSelectedTier

            return (
              <button
                key={tier.id}
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
                      {tier.name}
                    </span>
                    <span className="mt-1 block text-xs text-secondary">
                      {tier.pages}
                    </span>
                  </span>
                  {isSelected ? (
                    <CheckCircle2 className="size-4 text-brand" />
                  ) : null}
                </span>

                <span className="text-2xl font-semibold">{tier.price}</span>
                <span className="text-sm text-secondary">
                  {tier.description}
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
          {applicableTier === "ENTERPRISE_CUSTOM" ? (
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
