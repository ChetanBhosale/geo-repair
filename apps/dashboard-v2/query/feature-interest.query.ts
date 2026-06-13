"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  getAiVisibilityInterest,
  markAiVisibilityInterest,
} from "@/lib/api"

const AI_VISIBILITY_QUERY_KEY = ["feature-interest", "ai-visibility"] as const

export function useAiVisibilityInterest() {
  return useQuery({
    queryKey: AI_VISIBILITY_QUERY_KEY,
    queryFn: getAiVisibilityInterest,
  })
}

export function useMarkAiVisibilityInterest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (projectId?: string) => markAiVisibilityInterest({ projectId }),
    onSuccess: (interest) => {
      qc.setQueryData(AI_VISIBILITY_QUERY_KEY, interest)
    },
  })
}
