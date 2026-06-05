import type { OrderStatus } from "@repo/types/billing"
import type { FixCheckStatus } from "@repo/types/fix"
import type { ProjectReportStatus } from "@repo/types/reports"

export type DashboardBadgeVariant =
  | "default"
  | "pass"
  | "partial"
  | "fail"
  | "muted"

export function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100)
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

export function formatStatusLabel(value: string) {
  return value.toLowerCase().replaceAll("_", " ")
}

export function reportStatusVariant(
  status: ProjectReportStatus
): DashboardBadgeVariant {
  if (status === "READY") return "pass"
  if (status === "FAILED") return "fail"
  return "muted"
}

export function orderStatusVariant(status: OrderStatus): DashboardBadgeVariant {
  if (status === "PAID") return "pass"
  if (status === "FAILED" || status === "DISPUTED") return "fail"
  if (status === "REFUNDED" || status === "CANCELED") return "muted"
  return "partial"
}

export function fixCheckStatusVariant(
  status: FixCheckStatus
): DashboardBadgeVariant {
  if (status === "FIXED") return "pass"
  if (status === "FAILED") return "fail"
  return "muted"
}
