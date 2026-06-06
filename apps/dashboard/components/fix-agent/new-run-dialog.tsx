"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { FixIntakeForm } from "@/components/fix-agent/fix-intake-form"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useUser } from "@/hooks/use-auth"
import { useBillingHistory } from "@/hooks/use-billing"
import { useStartFix } from "@/hooks/use-fix"

interface RepoOption {
  id: string
  fullName: string
  website?: string | null
}

// "Start a fix run" modal: wraps the existing intake form and owns the order /
// website / start-fix logic that used to clutter the page body.
export function NewRunDialog({
  open,
  onOpenChange,
  selectedRepo,
  onStarted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedRepo: RepoOption | null
  onStarted: (runId: string) => void
}) {
  const { isSignedIn } = useUser()
  const billing = useBillingHistory(isSignedIn)
  const startFix = useStartFix()
  const searchParams = useSearchParams()
  const queryOrderId = searchParams.get("order_id")

  const [website, setWebsite] = React.useState("")
  const [selectedOrderOverride, setSelectedOrderOverride] = React.useState<
    string | null
  >(null)
  const prefetchedWebsiteRepoId = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (
      selectedRepo?.website &&
      prefetchedWebsiteRepoId.current !== selectedRepo.id &&
      !website.trim()
    ) {
      setWebsite(selectedRepo.website)
      prefetchedWebsiteRepoId.current = selectedRepo.id
    }
  }, [selectedRepo?.id, selectedRepo?.website, website])

  const paidOrders = React.useMemo(() => {
    const repoFullName = selectedRepo?.fullName
    return (billing.data?.orders ?? []).filter(
      (order) =>
        order.status === "PAID" &&
        (!repoFullName || order.repoFullName === repoFullName),
    )
  }, [billing.data?.orders, selectedRepo?.fullName])

  const requestedOrderId = selectedOrderOverride ?? queryOrderId
  const selectedOrder =
    paidOrders.find((order) => order.id === requestedOrderId) ??
    paidOrders[0] ??
    null
  const formWebsite = selectedOrder?.website ?? website

  function onStartFix(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedRepo || !selectedOrder || !formWebsite.trim()) {
      return
    }
    startFix.mutate(
      {
        repositoryId: selectedRepo.id,
        orderId: selectedOrder.id,
        website: formWebsite.trim(),
      },
      {
        onSuccess: (data) => onStarted(data.fixRunId),
      },
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogHeader>
          <DialogTitle>Start a fix run</DialogTitle>
        </DialogHeader>
        {selectedRepo ? (
          <div className="px-1 pb-1">
            <FixIntakeForm
              error={startFix.error ?? null}
              isPending={startFix.isPending}
              onOrderChange={setSelectedOrderOverride}
              onSubmit={onStartFix}
              onWebsiteChange={setWebsite}
              paidOrders={paidOrders}
              selectedOrderId={selectedOrder?.id ?? null}
              selectedRepoFullName={selectedRepo.fullName}
              website={formWebsite}
              websiteDisabled={!!selectedOrder}
            />
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-secondary">
            Choose a repository in settings before starting a fix run.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
