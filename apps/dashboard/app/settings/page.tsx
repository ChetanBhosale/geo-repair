"use client"

import * as React from "react"
import {
  CreditCard,
  Download,
  GitBranch,
  Loader2,
  LogOut,
  Mail,
  MessageSquareText,
  ReceiptText,
  RefreshCw,
} from "lucide-react"
import type { BillingInvoice, BillingOrder } from "@repo/types/billing"
import { loginWithGithub, useLogout, useUser } from "@/hooks/use-auth"
import { useBillingHistory, useBillingInvoice } from "@/hooks/use-billing"
import { useSavedRepos } from "@/hooks/use-repos"
import { DashboardShell } from "@/components/dashboard-shell"
import { RepoPicker } from "@/components/repo-picker"
import { StatePanel } from "@/components/state-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ENDPOINTS } from "@/lib/endpoint"

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
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Account</CardTitle>
                    <CardDescription>
                      Authenticated dashboard identity.
                    </CardDescription>
                  </div>
                  <Button
                    disabled={logout.isPending}
                    onClick={() => logout.mutate()}
                    variant="outline"
                  >
                    {logout.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <LogOut className="size-4" />
                    )}
                    Sign out
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <SettingRow label="User ID" value={user?.id ?? "Unavailable"} />
                <SettingRow
                  label="Email"
                  value={user?.email ?? "Unavailable"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Billing</CardTitle>
                    <CardDescription>
                      One-time checkout records, invoices, and payment history.
                    </CardDescription>
                  </div>
                  <Button onClick={() => billing.refetch()} variant="outline">
                    <RefreshCw className="size-4" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                {billing.isLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading billing history
                  </p>
                ) : null}
                {billing.isError ? (
                  <StatePanel
                    eyebrow="Billing error"
                    title="Could not load billing history"
                    description={(billing.error as Error).message}
                    tone="danger"
                  />
                ) : null}
                {!billing.isLoading && orders.length === 0 ? (
                  <StatePanel
                    eyebrow="No billing yet"
                    title="No checkout records"
                    description="Paid fix orders and generated invoice receipts will appear here after checkout."
                  />
                ) : null}
                {orders.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric
                      label="Total paid"
                      value={formatMoney(
                        orders
                          .filter((order) => order.status === "PAID")
                          .reduce((sum, order) => sum + order.amountCents, 0),
                        orders[0]?.currency ?? "USD"
                      )}
                    />
                    <Metric label="Orders" value={String(orders.length)} />
                    <Metric label="Invoices" value={String(invoices.length)} />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Support</CardTitle>
                <CardDescription>
                  Reach support or send dashboard feedback.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <a href="mailto:support@geo.repair">
                    <Mail className="size-4" />
                    Contact support
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href="mailto:feedback@geo.repair?subject=Dashboard%20feedback">
                    <MessageSquareText className="size-4" />
                    Submit feedback
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>
                  View and download invoice receipts generated from stored
                  payment records.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {invoices.length > 0 ? (
                  <div className="grid gap-2">
                    {invoices.map((item) => (
                      <InvoiceRow
                        invoice={item}
                        isSelected={item.orderId === selectedOrderId}
                        key={item.id}
                        onSelect={() => setExplicitOrderId(item.orderId)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No invoices are available yet.
                  </p>
                )}

                {invoice.isLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading invoice
                  </p>
                ) : null}
                {invoice.isError ? (
                  <p className="text-sm text-destructive">
                    {(invoice.error as Error).message}
                  </p>
                ) : null}
                {invoice.data ? (
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {invoice.data.id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.data.description}
                        </p>
                      </div>
                      <Badge variant={orderBadge(invoice.data.status)}>
                        {invoice.data.status.toLowerCase().replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm">
                      <SettingRow
                        label="Customer"
                        value={invoice.data.customerEmail ?? "Unavailable"}
                      />
                      <SettingRow
                        label="Website"
                        value={invoice.data.website}
                      />
                      <SettingRow
                        label="Total"
                        value={formatMoney(
                          invoice.data.amountCents,
                          invoice.data.currency
                        )}
                      />
                      <SettingRow
                        label="Paid"
                        value={
                          invoice.data.paidAt
                            ? new Date(invoice.data.paidAt).toLocaleString()
                            : "Not paid"
                        }
                      />
                    </div>
                    <div className="mt-4 grid gap-2">
                      {invoice.data.lineItems.map((item) => (
                        <div
                          className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/25 px-3 py-2 text-sm"
                          key={item.label}
                        >
                          <span>{item.label}</span>
                          <span className="font-medium">
                            {formatMoney(
                              item.amountCents,
                              invoice.data.currency
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Button asChild className="mt-4" variant="outline">
                      <a
                        href={ENDPOINTS.billingInvoiceDownload(
                          invoice.data.orderId
                        )}
                      >
                        <Download className="size-4" />
                        Download receipt
                      </a>
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment history</CardTitle>
                <CardDescription>
                  Latest one-time fix checkout attempts and their statuses.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {orders.length > 0 ? (
                  orders.map((order) => (
                    <OrderRow key={order.id} order={order} />
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No payment history yet.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>GitHub repository</CardTitle>
                <CardDescription>
                  Choose the repo the sandbox will clone and open a PR against.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RepoPicker />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Saved projects</CardTitle>
                <CardDescription>
                  One project maps to one selected repository.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {savedRepos.isLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading repositories
                  </p>
                ) : null}
                {savedRepos.isError ? (
                  <p className="text-sm text-destructive">
                    {(savedRepos.error as Error).message}
                  </p>
                ) : null}
                {!savedRepos.isLoading && repositories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No saved repositories yet.
                  </p>
                ) : null}
                {repositories.map((repo) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    key={repo.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {repo.fullName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {repo.defaultBranch}
                      </p>
                    </div>
                    {repo.selected ? (
                      <Badge variant="pass">Active</Badge>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}
    </DashboardShell>
  )
}

function InvoiceRow({
  invoice,
  isSelected,
  onSelect,
}: {
  invoice: BillingInvoice
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      className={`rounded-lg border p-3 text-left transition-colors ${
        isSelected
          ? "border-foreground bg-muted/40"
          : "border-border bg-background hover:bg-muted/25"
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{invoice.id}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {invoice.website}
          </p>
        </div>
        <Badge variant={orderBadge(invoice.status)}>
          {invoice.status.toLowerCase().replaceAll("_", " ")}
        </Badge>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {new Date(invoice.issuedAt).toLocaleDateString()}
        </span>
        <span className="font-medium">
          {formatMoney(invoice.amountCents, invoice.currency)}
        </span>
      </div>
    </button>
  )
}

function OrderRow({ order }: { order: BillingOrder }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{order.website}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {order.repoFullName ?? "No repository selected"}
          </p>
        </div>
        <Badge variant={orderBadge(order.status)}>
          {order.status.toLowerCase().replaceAll("_", " ")}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CreditCard className="size-3.5" />
          {formatMoney(order.amountCents, order.currency)}
        </span>
        <span className="inline-flex items-center gap-1">
          <ReceiptText className="size-3.5" />
          {order.providerPaymentId ??
            order.providerSessionId ??
            "No provider ID"}
        </span>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/25 p-4">
      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  )
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-mono text-xs">{value}</span>
    </div>
  )
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

function orderBadge(status: BillingOrder["status"]) {
  if (status === "PAID") return "pass"
  if (status === "FAILED" || status === "DISPUTED") return "fail"
  if (status === "REFUNDED" || status === "CANCELED") return "muted"
  return "partial"
}
