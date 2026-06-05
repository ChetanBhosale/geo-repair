"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getMe, logout } from "@/lib/api"
import { ENDPOINTS } from "@/lib/endpoint"

export function useUser() {
  const query = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
  })

  return {
    user: query.data?.user ?? null,
    isLoading: query.isLoading,
    isSignedIn: !!query.data?.user,
  }
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => qc.setQueryData(["me"], null),
  })
}

// Full-page redirect to the backend, which kicks off the GitHub OAuth flow.
export function loginWithGithub(redirectTo?: string | null) {
  const url = new URL(ENDPOINTS.githubLogin)
  const safeRedirectTo = safeDashboardPath(redirectTo)

  if (safeRedirectTo) {
    url.searchParams.set("redirect_to", safeRedirectTo)
  }

  window.location.href = url.toString()
}

function safeDashboardPath(value: string | null | undefined) {
  if (!value) return null

  const trimmed = value.trim()
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    /[\r\n]/.test(trimmed)
  ) {
    return null
  }

  return trimmed.slice(0, 512)
}
