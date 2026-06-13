"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"

import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { projectOverviewPath, routeWithQuery } from "@/lib/project-routes"
import { useProject } from "@/query/project.query"

export default function LegacyProjectDetailPage() {
  const params = useParams<{ projectId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const project = useProject(params.projectId)

  React.useEffect(() => {
    if (!project.data) return
    router.replace(routeWithQuery(projectOverviewPath(project.data), searchParams))
  }, [project.data, router, searchParams])

  if (project.isError) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">
        Project not found.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <DashboardInlineLoading rows={3} />
    </div>
  )
}
