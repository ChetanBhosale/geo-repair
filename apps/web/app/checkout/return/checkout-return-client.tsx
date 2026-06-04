"use client"

import { useEffect, useMemo, useState } from "react"

import type { OrderSummary } from "@repo/types"

import { Button } from "@/components/ui/button"

type LoadState =
  | { state: "loading"; order: null; error: null }
  | { state: "ready"; order: OrderSummary; error: null }
  | { state: "error"; order: null; error: string }

function formatPrice(order: OrderSummary): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: order.currency,
  }).format(order.amountCents / 100)
}

function statusCopy(order: OrderSummary) {
  switch (order.status) {
    case "PAID":
      return {
        title: "Payment confirmed",
        body: "Your AI Search Fix order is paid and the start step is unlocked.",
      }
    case "PROCESSING":
    case "CHECKOUT_CREATED":
    case "PENDING":
      return {
        title: "Payment pending",
        body: "We are waiting for Dodo Payments to confirm the checkout by webhook.",
      }
    case "FAILED":
      return {
        title: "Payment failed",
        body: "Dodo Payments reported that the payment failed. You can retry checkout from the order flow.",
      }
    case "CANCELED":
      return {
        title: "Payment canceled",
        body: "The checkout was canceled before payment completed.",
      }
    case "REFUNDED":
      return {
        title: "Payment refunded",
        body: "This order has been refunded.",
      }
    case "DISPUTED":
      return {
        title: "Payment needs review",
        body: "This order has a payment dispute and needs support review.",
      }
  }
}

export function CheckoutReturnClient({ orderId }: { orderId: string }) {
  const [loadState, setLoadState] = useState<LoadState>({
    state: "loading",
    order: null,
    error: null,
  })

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setInterval> | null = null

    async function load() {
      try {
        const response = await fetch(`/api/billing/orders/${orderId}`, {
          cache: "no-store",
        })
        const data = (await response.json()) as {
          order?: OrderSummary
          error?: string
        }

        if (!active) return

        if (!response.ok || !data.order) {
          setLoadState({
            state: "error",
            order: null,
            error: data.error ?? "Unable to load order status.",
          })
          return
        }

        setLoadState({ state: "ready", order: data.order, error: null })

        if (
          ["PAID", "FAILED", "CANCELED", "REFUNDED", "DISPUTED"].includes(
            data.order.status
          ) &&
          timer
        ) {
          clearInterval(timer)
        }
      } catch {
        if (!active) return
        setLoadState({
          state: "error",
          order: null,
          error: "Unable to load order status.",
        })
      }
    }

    void load()
    timer = setInterval(load, 3000)

    return () => {
      active = false
      if (timer) clearInterval(timer)
    }
  }, [orderId])

  const copy = useMemo(() => {
    if (loadState.state !== "ready") return null
    return statusCopy(loadState.order)
  }, [loadState])

  if (loadState.state === "loading") {
    return (
      <div className="border border-border bg-card p-8 text-center">
        <p className="font-heading text-xl font-medium text-foreground">
          Checking payment status
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Waiting for the latest order state.
        </p>
      </div>
    )
  }

  if (loadState.state === "error") {
    return (
      <div className="border border-border bg-card p-8 text-center">
        <p className="font-heading text-xl font-medium text-foreground">
          Order status unavailable
        </p>
        <p className="mt-3 text-sm text-muted-foreground">{loadState.error}</p>
      </div>
    )
  }

  const { order } = loadState

  return (
    <div className="border border-border bg-card">
      <div className="border-b border-border p-8 text-center">
        <p className="font-heading text-2xl font-medium text-foreground">
          {copy?.title}
        </p>
        <p className="mx-auto mt-3 max-w-lg text-sm/relaxed text-muted-foreground">
          {copy?.body}
        </p>
      </div>

      <dl className="grid gap-px bg-border text-sm sm:grid-cols-2">
        <div className="bg-card p-5">
          <dt className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Order
          </dt>
          <dd className="mt-2 font-mono text-xs text-foreground">{order.id}</dd>
        </div>
        <div className="bg-card p-5">
          <dt className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Amount
          </dt>
          <dd className="mt-2 text-foreground">{formatPrice(order)}</dd>
        </div>
        <div className="bg-card p-5">
          <dt className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Site
          </dt>
          <dd className="mt-2 break-words text-foreground">{order.website}</dd>
        </div>
        <div className="bg-card p-5">
          <dt className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Status
          </dt>
          <dd className="mt-2 text-foreground">{order.status}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs/relaxed text-muted-foreground">
          Payment state is updated only by Dodo webhooks.
        </p>
        <Button disabled={!order.startFixUnlocked}>
          {order.startFixUnlocked ? "Start fix unlocked" : "Waiting for payment"}
        </Button>
      </div>
    </div>
  )
}
