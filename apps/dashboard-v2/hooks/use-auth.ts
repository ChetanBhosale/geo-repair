"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getMe, logout } from "@/lib/api"
import { ENDPOINTS } from "@/lib/endpoint"

// Reads the current session via the backend me() route.
export function useAuth() {
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
    onSuccess: () => {
      // Wipe every cached query so the next user never sees stale data.
      qc.clear()
      qc.setQueryData(["me"], null)
    },
  })
}

// Full-page redirect to the backend, which kicks off Google OAuth.
export function loginWithGoogle() {
  window.location.href = ENDPOINTS.googleLogin
}

// Full-page redirect to connect/link GitHub to the current user.
export function loginWithGithub() {
  window.location.href = ENDPOINTS.githubLogin
}
