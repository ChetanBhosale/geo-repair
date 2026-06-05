"use client"

import {
  CreditCard,
  Download,
  Loader2,
  LogOut,
  Mail,
  MessageSquareText,
  ReceiptText,
  RefreshCw,
} from "lucide-react"
import type {
  BillingInvoice,
  BillingInvoiceDetail,
  BillingOrder,
} from "@repo/types/billing"
import type { SavedRepository } from "@repo/types/github"
import type { User } from "@repo/types/user"
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatStatusLabel,
  orderStatusVariant,
} from "@/lib/dashboard-format"
import { ENDPOINTS } from "@/lib/endpoint"
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

export function AccountCard({
  isLogoutPending,
  onLogout,
  user,
}: {
  isLogoutPending: boolean
  onLogout: () => void
  user: User | null
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Account</CardTitle>
            <CardDescription>Authenticated dashboard identity.</CardDescription>
          </div>
          <Button
            disabled={isLogoutPending}
            onClick={onLogout}
            variant="outline"
          >
            {isLogoutPending ? (
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
        <SettingRow label="Email" value={user?.email ?? "Unavailable"} />
      </CardContent>
    </Card>
  )
}

export function BillingSummaryCard({
  error,
  invoices,
  isLoading,
  onRefresh,
  orders,
}: {
  error: Error | null
  invoices: BillingInvoice[]
  isLoading: boolean
  onRefresh: () => void
  orders: BillingOrder[]
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Billing</CardTitle>
            <CardDescription>
              One-time checkout records, invoices, and payment history.
            </CardDescription>
          </div>
          <Button onClick={onRefresh} variant="outline">
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading billing history
          </p>
        ) : null}
        {error ? (
          <StatePanel
            eyebrow="Billing error"
            title="Could not load billing history"
            description={error.message}
            tone="danger"
          />
        ) : null}
        {!isLoading && orders.length === 0 ? (
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
  )
}

export function SupportCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Support</CardTitle>
        <CardDescription>Reach support or send dashboard feedback.</CardDescription>
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
  )
}

export function InvoicesCard({
  error,
  invoice,
  invoices,
  isLoading,
  onSelectInvoice,
  selectedOrderId,
}: {
  error: Error | null
  invoice: BillingInvoiceDetail | null
  invoices: BillingInvoice[]
  isLoading: boolean
  onSelectInvoice: (orderId: string) => void
  selectedOrderId: string | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>
          View and download invoice receipts generated from stored payment
          records.
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
                onSelect={() => onSelectInvoice(item.orderId)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No invoices are available yet.
          </p>
        )}

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading invoice
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        {invoice ? <InvoiceDetail invoice={invoice} /> : null}
      </CardContent>
    </Card>
  )
}

export function PaymentHistoryCard({ orders }: { orders: BillingOrder[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment history</CardTitle>
        <CardDescription>
          Latest one-time fix checkout attempts and their statuses.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {orders.length > 0 ? (
          orders.map((order) => <OrderRow key={order.id} order={order} />)
        ) : (
          <p className="text-sm text-muted-foreground">No payment history yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

export function RepositoryCard() {
  return (
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
  )
}

export function SavedProjectsCard({
  error,
  isLoading,
  repositories,
}: {
  error: Error | null
  isLoading: boolean
  repositories: SavedRepository[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved projects</CardTitle>
        <CardDescription>One project maps to one selected repository.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading repositories
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        {!isLoading && repositories.length === 0 ? (
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
              <p className="truncate text-sm font-medium">{repo.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {repo.defaultBranch}
              </p>
            </div>
            {repo.selected ? <Badge variant="pass">Active</Badge> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function InvoiceDetail({ invoice }: { invoice: BillingInvoiceDetail }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{invoice.id}</p>
          <p className="text-xs text-muted-foreground">{invoice.description}</p>
        </div>
        <Badge variant={orderStatusVariant(invoice.status)}>
          {formatStatusLabel(invoice.status)}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        <SettingRow
          label="Customer"
          value={invoice.customerEmail ?? "Unavailable"}
        />
        <SettingRow label="Website" value={invoice.website} />
        <SettingRow
          label="Total"
          value={formatMoney(invoice.amountCents, invoice.currency)}
        />
        <SettingRow
          label="Paid"
          value={invoice.paidAt ? formatDateTime(invoice.paidAt) : "Not paid"}
        />
      </div>
      <div className="mt-4 grid gap-2">
        {invoice.lineItems.map((item) => (
          <div
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/25 px-3 py-2 text-sm"
            key={item.label}
          >
            <span>{item.label}</span>
            <span className="font-medium">
              {formatMoney(item.amountCents, invoice.currency)}
            </span>
          </div>
        ))}
      </div>
      <Button asChild className="mt-4" variant="outline">
        <a href={ENDPOINTS.billingInvoiceDownload(invoice.orderId)}>
          <Download className="size-4" />
          Download receipt
        </a>
      </Button>
    </div>
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
        <Badge variant={orderStatusVariant(invoice.status)}>
          {formatStatusLabel(invoice.status)}
        </Badge>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {formatDate(invoice.issuedAt)}
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
        <Badge variant={orderStatusVariant(order.status)}>
          {formatStatusLabel(order.status)}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CreditCard className="size-3.5" />
          {formatMoney(order.amountCents, order.currency)}
        </span>
        <span className="inline-flex items-center gap-1">
          <ReceiptText className="size-3.5" />
          {order.providerPaymentId ?? order.providerSessionId ?? "No provider ID"}
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
