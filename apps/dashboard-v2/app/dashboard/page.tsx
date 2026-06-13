"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { projectOverviewPath } from "@/lib/project-routes"
import { useProjects, useSelectedProject } from "@/query/project.query"

export default function DashboardPage() {
  const router = useRouter()
  const projects = useProjects()
  const selected = useSelectedProject()

  React.useEffect(() => {
    if (selected.data) {
      router.replace(projectOverviewPath(selected.data))
      return
    }

    if (selected.isError && !projects.isLoading) {
      const fallback =
        projects.data?.find((project) => project.selected) ?? projects.data?.[0]
      router.replace(fallback ? projectOverviewPath(fallback) : "/dashboard/projects")
    }
  }, [
    projects.data,
    projects.isLoading,
    router,
    selected.data,
    selected.isError,
  ])

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <DashboardInlineLoading rows={3} />
    </div>
  )
}
