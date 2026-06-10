"use client"

import { CreditCardIcon } from "@phosphor-icons/react"
import { PageHeader } from "@/components/dashboard/page-header"

export default function PurchasePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <PageHeader
        title="Purchase"
        description="Plans, fix credits, and payment history."
      />
      <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-20 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <CreditCardIcon className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold">Nothing to purchase yet</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Run a scan on a project to get a quote, then buy a fix. Your orders
          and invoices will show up here.
        </p>
      </div>
    </div>
  )
}
