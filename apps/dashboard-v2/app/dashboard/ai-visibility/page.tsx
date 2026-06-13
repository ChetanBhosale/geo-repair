"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { projectAiVisibilityPath } from "@/lib/project-routes"
import { useProjects, useSelectedProject } from "@/query/project.query"

export default function LegacyAiVisibilityPage() {
  const router = useRouter()
  const projects = useProjects()
  const selected = useSelectedProject()

  React.useEffect(() => {
    const project =
      selected.data ??
      projects.data?.find((item) => item.selected) ??
      projects.data?.[0]
    if (project) router.replace(projectAiVisibilityPath(project))
  }, [projects.data, router, selected.data])

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <DashboardInlineLoading rows={3} />
    </div>
  )
}
