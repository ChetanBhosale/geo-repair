"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CreateFixCheckoutRequest } from "@repo/types/billing"
import {
  createFixCheckout,
  getBillingHistory,
  getBillingInvoice,
  getPlans,
} from "@/lib/api"

export function usePlans(enabled = true) {
  return useQuery({
    queryKey: ["billing-plans"],
    queryFn: getPlans,
    staleTime: 5 * 60 * 1000,
    enabled,
  })
}

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

export function useCreateFixCheckout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateFixCheckoutRequest) =>
      createFixCheckout(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-history"] })
    },
  })
}
