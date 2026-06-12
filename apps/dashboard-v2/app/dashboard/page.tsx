"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"

// /dashboard always lands on the projects view.
export default function DashboardPage() {
  const router = useRouter()
  React.useEffect(() => {
    router.replace("/dashboard/projects")
  }, [router])
  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <DashboardInlineLoading rows={3} />
    </div>
  )
}
