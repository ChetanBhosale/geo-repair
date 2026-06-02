"use client"

import { Suspense, useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { usePostHog } from "posthog-js/react"

// App Router never fires a full page load on client-side navigation, and we
// disabled posthog's automatic pageview to avoid double-counting. So capture
// $pageview ourselves whenever the path or query changes.
function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthog = usePostHog()

  useEffect(() => {
    if (!pathname || !posthog) return
    let url = window.origin + pathname
    const query = searchParams?.toString()
    if (query) url += `?${query}`
    posthog.capture("$pageview", { $current_url: url })
  }, [pathname, searchParams, posthog])

  return null
}

// useSearchParams must sit inside a Suspense boundary or it opts the whole
// route out of static rendering.
export function SuspendedPostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageView />
    </Suspense>
  )
}
