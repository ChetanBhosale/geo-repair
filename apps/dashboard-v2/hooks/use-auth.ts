"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getMe, logout, type AuthUser } from "@/lib/api"
import { ENDPOINTS } from "@/lib/endpoint"
import { authLoginUrl, currentDashboardRedirectPath } from "@/lib/auth-redirect"
import { clearDashboardQueryCachePersistence } from "@/lib/query-cache-persistence"

const AUTH_SNAPSHOT_KEY = "geo-repair.dashboard.auth.v1"
const AUTH_SNAPSHOT_MAX_AGE_MS = 30 * 60 * 1000
const SESSION_REJECTED_ERRORS = new Set([
  "Not authenticated",
  "Invalid or expired session",
  "User not found",
])
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

type AuthSnapshot = {
  savedAt: number
  user: AuthUser
}

function authStorage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function readAuthSnapshot(): AuthUser | null {
  const store = authStorage()
  if (!store) return null

  try {
    const raw = store.getItem(AUTH_SNAPSHOT_KEY)
    if (!raw) return null

    const snapshot = JSON.parse(raw) as AuthSnapshot
    if (!snapshot?.user || Date.now() - snapshot.savedAt > AUTH_SNAPSHOT_MAX_AGE_MS) {
      store.removeItem(AUTH_SNAPSHOT_KEY)
      return null
    }
    return snapshot.user
  } catch {
    store.removeItem(AUTH_SNAPSHOT_KEY)
    return null
  }
}

function writeAuthSnapshot(user: AuthUser) {
  authStorage()?.setItem(
    AUTH_SNAPSHOT_KEY,
    JSON.stringify({ savedAt: Date.now(), user } satisfies AuthSnapshot)
  )
}

function clearAuthSnapshot() {
  authStorage()?.removeItem(AUTH_SNAPSHOT_KEY)
}

// Reads the current session via the backend me() route.
export function useAuth() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    refetchOnMount: "always",
    retry: false,
  })

  const errorMessage = query.error instanceof Error ? query.error.message : ""
  const sessionRejected = SESSION_REJECTED_ERRORS.has(errorMessage)
  const user = sessionRejected ? null : (query.data?.user ?? null)

  useIsomorphicLayoutEffect(() => {
    const cachedUser = readAuthSnapshot()
    if (cachedUser && !query.data?.user) {
      qc.setQueryData(["me"], { user: cachedUser }, { updatedAt: Date.now() })
    }
  }, [qc, query.data?.user])

  React.useEffect(() => {
    if (query.data?.user) writeAuthSnapshot(query.data.user)
    if (sessionRejected) {
      clearAuthSnapshot()
      clearDashboardQueryCachePersistence()
    }
  }, [query.data?.user, sessionRejected])

  return {
    user,
    isLoading: query.isLoading && !user,
    isSignedIn: !!user,
  }
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Wipe every cached query so the next user never sees stale data.
      clearAuthSnapshot()
      clearDashboardQueryCachePersistence()
      qc.clear()
      qc.setQueryData(["me"], null)
    },
  })
}

// Full-page redirect to the backend, which kicks off Google OAuth.
export function loginWithGoogle(redirectTo?: string) {
  window.location.href = authLoginUrl(
    ENDPOINTS.googleLogin,
    redirectTo ?? currentDashboardRedirectPath()
  )
}

// Full-page redirect to connect/link GitHub to the current user.
export function loginWithGithub(redirectTo?: string) {
  window.location.href = authLoginUrl(
    ENDPOINTS.githubLogin,
    redirectTo ?? currentDashboardRedirectPath()
  )
}
