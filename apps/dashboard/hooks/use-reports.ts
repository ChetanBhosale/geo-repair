"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createReportShareLink,
  generateReports,
  getReport,
  getReports,
  getSharedReport,
  revokeReportShareLink,
} from "@/lib/api"

export function useReports(enabled = true) {
  return useQuery({
    queryKey: ["reports"],
    queryFn: getReports,
    enabled,
  })
}

export function useGenerateReports() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: generateReports,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  })
}

export function useReport(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ["report", id],
    queryFn: () => getReport(id as string),
    enabled: enabled && !!id,
  })
}

export function useSharedReport(token: string | null, enabled = true) {
  return useQuery({
    queryKey: ["shared-report", token],
    queryFn: () => getSharedReport(token as string),
    enabled: enabled && !!token,
  })
}

export function useCreateReportShareLink() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: createReportShareLink,
    onSuccess: (_share, reportId) => {
      qc.invalidateQueries({ queryKey: ["reports"] })
      qc.invalidateQueries({ queryKey: ["report", reportId] })
    },
  })
}

export function useRevokeReportShareLink() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: revokeReportShareLink,
    onSuccess: (_result, reportId) => {
      qc.invalidateQueries({ queryKey: ["reports"] })
      qc.invalidateQueries({ queryKey: ["report", reportId] })
    },
  })
}
