"use client"

import * as React from "react"
import { GitBranch, Loader2 } from "lucide-react"
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
import { StatePanel } from "@/components/state-panel"
import { Button } from "@/components/ui/button"
import { loginWithGithub, useLogout, useUser } from "@/hooks/use-auth"
import { useBillingHistory, useBillingInvoice } from "@/hooks/use-billing"
import { useSavedRepos } from "@/hooks/use-repos"

export default function SettingsPage() {
  const { user, isLoading, isSignedIn } = useUser()
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
      {isLoading ? (
        <StatePanel
          eyebrow="Loading"
          title="Loading account"
          description="We are checking your session and project settings."
          action={
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          }
        />
      ) : null}

      {!isLoading && !isSignedIn ? (
        <StatePanel
          eyebrow="GitHub required"
          title="Connect GitHub to manage settings"
          description="Repository access, reports, fix runs, and billing history are scoped to your authenticated GitHub account."
          action={
            <Button onClick={loginWithGithub}>
              <GitBranch className="size-4" />
              Continue with GitHub
            </Button>
          }
        />
      ) : null}

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
