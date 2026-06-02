"use client"

import { useEffect } from "react"
import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"

import { SuspendedPostHogPageView } from "./posthog-pageview"

// Single client boundary for analytics. The root layout stays a server
// component; this wraps {children} so every route is covered. Init runs only
// in the browser, after hydration, and only when a project key is set, so the
// app runs fine without analytics configured and nothing blocks SSR/SEO.
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key || posthog.__loaded) return

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest",
      ui_host: "https://us.posthog.com",
      // We capture $pageview manually on route changes (see PostHogPageView).
      capture_pageview: false,
      capture_pageleave: true,
      // Anonymous marketing site: don't mint a person profile per visitor.
      person_profiles: "identified_only",
      // Events + autocapture only, no session replay. Off here regardless of
      // the project's "Record user sessions" setting.
      disable_session_recording: true,
    })
  }, [])

  return (
    <PHProvider client={posthog}>
      <SuspendedPostHogPageView />
      {children}
    </PHProvider>
  )
}
