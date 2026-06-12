"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { WorkerStatusProvider } from "@/context/worker-status"
import { currentDashboardRedirectPath } from "@/lib/auth-redirect"

export default function DashboardRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isLoading, isSignedIn } = useAuth()

  React.useEffect(() => {
    if (!isLoading && !isSignedIn) {
      const next = encodeURIComponent(currentDashboardRedirectPath())
      router.replace(`/sign-in?next=${next}`)
    }
  }, [isLoading, isSignedIn, router])

  if (!isSignedIn) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-5xl px-6 py-6">
          <DashboardInlineLoading rows={2} />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <WorkerStatusProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </WorkerStatusProvider>
  )
}
