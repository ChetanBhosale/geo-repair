"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  CheckCircleIcon,
  CreditCardIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  useBillingHistory,
  useBillingOrder,
  useBillingPlans,
} from "@/query/billing.query"
import { useStartAgentPlan } from "@/query/agent.query"

function formatPrice(amountCents: number, currency = "USD") {
  if (amountCents === 0) return "Custom"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountCents / 100)
}

export default function PurchasePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")
  const order = useBillingOrder(orderId)
  const plans = useBillingPlans()
  const history = useBillingHistory()
  const projectId = order.data?.projectId ?? ""
  const startAgentPlan = useStartAgentPlan(projectId)

  async function onStartFix() {
    if (!order.data?.projectId) {
      toast.error("This order is not linked to a project.")
      return
    }
    try {
      const created = await startAgentPlan.mutateAsync(order.data.id)
      router.push(
        `/dashboard/projects/${order.data.projectId}/agent/${created.agentRunId}`
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start the fix."
      )
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="Purchase"
        description="One-time AI Search Fix orders and plan history."
      />

      {orderId ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-medium">Checkout status</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Order {orderId}
              </p>
            </div>
            {order.isLoading ? (
              <SpinnerGapIcon className="size-4 animate-spin text-muted-foreground" />
            ) : order.data?.status === "PAID" ? (
              <CheckCircleIcon className="size-5 text-primary" />
            ) : (
              <CreditCardIcon className="size-5 text-muted-foreground" />
            )}
          </div>

          {order.isError ? (
            <div className="px-5 py-8 text-sm text-destructive">
              {(order.error as Error).message}
            </div>
          ) : order.data ? (
            <div className="grid gap-px bg-border sm:grid-cols-4">
              <div className="bg-card p-5">
                <p className="text-xs text-muted-foreground">Plan</p>
                <p className="mt-1 text-sm font-medium">{order.data.tier}</p>
              </div>
              <div className="bg-card p-5">
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="mt-1 text-sm font-medium">
                  {formatPrice(order.data.amountCents, order.data.currency)}
                </p>
              </div>
              <div className="bg-card p-5">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="mt-1 text-sm font-medium">{order.data.status}</p>
              </div>
              <div className="flex items-center justify-end bg-card p-5">
                {order.data.startFixUnlocked ? (
                  <Button
                    size="sm"
                    onClick={onStartFix}
                    disabled={startAgentPlan.isPending}
                  >
                    {startAgentPlan.isPending ? (
                      <SpinnerGapIcon className="size-4 animate-spin" />
                    ) : null}
                    Start fix
                  </Button>
                ) : (
                  <Button size="sm" disabled>
                    Waiting for payment
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="px-5 py-8 text-sm text-muted-foreground">
              Loading order.
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
        {(plans.data ?? []).map((plan) => (
          <div key={plan.tier} className="bg-card p-5">
            <div className="flex min-h-20 flex-col gap-1">
              <h2 className="text-sm font-medium">{plan.name}</h2>
              <p className="text-xs text-muted-foreground">{plan.pageCover}</p>
            </div>
            <p className="mt-4 text-2xl font-semibold">
              {formatPrice(plan.amountCents, plan.currency)}
            </p>
            <p className="mt-3 min-h-10 text-xs text-muted-foreground">
              {plan.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">Orders</h2>
        </div>
        {(history.data?.orders.length ?? 0) > 0 ? (
          <div className="divide-y divide-border">
            {history.data!.orders.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[1fr_auto_auto]"
              >
                <div>
                  <p className="font-medium">{item.website}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.repoFullName ?? "No repo linked"}
                  </p>
                </div>
                <p className="text-muted-foreground">
                  {formatPrice(item.amountCents, item.currency)}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {item.status}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Run a scan on a project to get a quote, then buy a fix.
          </div>
        )}
      </div>
    </div>
  )
}
