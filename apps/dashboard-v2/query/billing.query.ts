"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  createFixCheckout,
  getBillingHistory,
  getBillingOrder,
  getBillingPlans,
  reconcileBillingOrder,
} from "@/lib/api"

export function useBillingPlans() {
  return useQuery({
    queryKey: ["billing-plans"],
    queryFn: getBillingPlans,
  })
}

export function useBillingHistory() {
  return useQuery({
    queryKey: ["billing-history"],
    queryFn: getBillingHistory,
  })
}

export function useBillingOrder(orderId: string | null | undefined) {
  return useQuery({
    queryKey: ["billing-order", orderId],
    queryFn: () => getBillingOrder(orderId as string),
    enabled: !!orderId,
    refetchInterval: (query) =>
      ["PENDING", "CHECKOUT_CREATED", "PROCESSING"].includes(
        query.state.data?.status ?? ""
      )
        ? 3000
        : false,
  })
}

export function useCreateFixCheckout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createFixCheckout,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["billing-history"] })
      qc.invalidateQueries({ queryKey: ["billing-order", data.order.id] })
    },
  })
}

export function useReconcileBillingOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reconcileBillingOrder,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["billing-history"] })
      qc.invalidateQueries({ queryKey: ["billing-order", data.order.id] })
    },
  })
}
