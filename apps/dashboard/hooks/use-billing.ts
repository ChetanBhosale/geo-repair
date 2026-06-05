"use client"

import { useQuery } from "@tanstack/react-query"
import { getBillingHistory, getBillingInvoice } from "@/lib/api"

export function useBillingHistory(enabled = true) {
  return useQuery({
    queryKey: ["billing-history"],
    queryFn: getBillingHistory,
    enabled,
  })
}

export function useBillingInvoice(orderId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["billing-invoice", orderId],
    queryFn: () => getBillingInvoice(orderId as string),
    enabled: enabled && !!orderId,
  })
}
