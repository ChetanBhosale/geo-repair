"use client"

import * as React from "react"
import {
  AccountCard,
  BillingSummaryCard,
  InvoicesCard,
  PaymentHistoryCard,
  RepositoryCard,
  SavedProjectsCard,
  SupportCard,
} from "@/components/settings/settings-sections"
import { DashboardShell } from "@/components/dashboard-shell"
import { useLogout, useUser } from "@/hooks/use-auth"
import { useBillingHistory, useBillingInvoice } from "@/hooks/use-billing"
import { useSavedRepos } from "@/hooks/use-repos"

export default function SettingsPage() {
  const { user, isSignedIn } = useUser()
  const logout = useLogout()
  const savedRepos = useSavedRepos(isSignedIn)
  const billing = useBillingHistory(isSignedIn)
  const repositories = savedRepos.data ?? []
  const invoices = billing.data?.invoices ?? []
  const orders = billing.data?.orders ?? []
  const [explicitOrderId, setExplicitOrderId] = React.useState<string | null>(
    null
  )
  const selectedOrderId =
    explicitOrderId &&
    invoices.some((invoice) => invoice.orderId === explicitOrderId)
      ? explicitOrderId
      : (invoices[0]?.orderId ?? null)

  const invoice = useBillingInvoice(
    selectedOrderId,
    isSignedIn && !!selectedOrderId
  )

  return (
    <DashboardShell eyebrow="Settings" title="Project settings">
      {isSignedIn ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)]">
          <div className="grid gap-4">
            <AccountCard
              isLogoutPending={logout.isPending}
              onLogout={() => logout.mutate()}
              user={user}
            />

            <BillingSummaryCard
              error={billing.error ?? null}
              invoices={invoices}
              isLoading={billing.isLoading}
              onRefresh={() => billing.refetch()}
              orders={orders}
            />

            <SupportCard />
          </div>

          <div className="grid gap-4">
            <InvoicesCard
              error={invoice.error ?? null}
              invoice={invoice.data ?? null}
              invoices={invoices}
              isLoading={invoice.isLoading}
              onSelectInvoice={setExplicitOrderId}
              selectedOrderId={selectedOrderId}
            />

            <PaymentHistoryCard orders={orders} />

            <RepositoryCard />

            <SavedProjectsCard
              error={savedRepos.error ?? null}
              isLoading={savedRepos.isLoading}
              repositories={repositories}
            />
          </div>
        </section>
      ) : null}
    </DashboardShell>
  )
}
