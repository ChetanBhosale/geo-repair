"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { PageLoader } from "@/components/page-loader"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { WorkerStatusProvider } from "@/context/worker-status"

export default function DashboardRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isLoading, isSignedIn } = useAuth()

  React.useEffect(() => {
    if (!isLoading && !isSignedIn) {
      router.replace("/sign-in")
    }
  }, [isLoading, isSignedIn, router])

  if (isLoading || !isSignedIn) {
    return <PageLoader />
  }

  return (
    <WorkerStatusProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </WorkerStatusProvider>
  )
}
