"use client"

import type * as React from "react"
import { CreditCard, Loader2, MessagesSquare, Play } from "lucide-react"
import type { BillingOrder } from "@repo/types/billing"
import { formatMoney } from "@/lib/dashboard-format"
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
  isPending,
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
  isPending: boolean
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
          Select the paid order for {selectedRepoFullName}. The backend verifies
          it before starting the Temporal workflow.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 rounded-lg bg-secondary/20 p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-secondary" />
            <h2 className="text-sm font-semibold">Paid order</h2>
          </div>
          {paidOrders.length > 0 ? (
            <>
              <select
                className="h-9 rounded-lg bg-primary px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-focus/50"
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
                    {order.website} ·{" "}
                    {formatMoney(order.amountCents, order.currency)}
                  </option>
                ))}
              </select>
              {selectedOrder ? (
                <p className="text-xs text-secondary">
                  Order {selectedOrder.id} is paid and scoped to{" "}
                  {selectedOrder.repoFullName ?? selectedRepoFullName}.
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-secondary">
              Run a website scan, select this repository, and complete checkout
              before starting the fix agent.
            </p>
          )}
        </div>

        <div className="grid gap-2 rounded-lg bg-secondary/20 p-4">
          <div className="flex items-center gap-2">
            <MessagesSquare className="size-4 text-secondary" />
            <h2 className="text-sm font-semibold">
              Clarification happens after planning
            </h2>
          </div>
          <p className="text-sm text-secondary">
            After the scan builds a fix plan, the agent asks only the
            clarification questions required by those failed checks. The
            sandbox starts after you submit those answers.
          </p>
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
          <p className="mt-3 text-sm text-danger">{error.message}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
