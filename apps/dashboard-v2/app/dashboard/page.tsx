"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PageLoader } from "@/components/page-loader"

// /dashboard always lands on the projects view.
export default function DashboardPage() {
  const router = useRouter()
  React.useEffect(() => {
    router.replace("/dashboard/projects")
  }, [router])
  return <PageLoader />
}
