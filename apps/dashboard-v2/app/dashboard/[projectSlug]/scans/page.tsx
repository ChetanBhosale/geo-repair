"use client"

import { useParams } from "next/navigation"

import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { useProjectBySlug } from "@/query/project.query"
import { ProjectOverview } from "@/components/dashboard/project-overview"

export default function ProjectScansPage() {
  const params = useParams<{ projectSlug: string }>()
  const project = useProjectBySlug(params.projectSlug)

  if (project.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <DashboardInlineLoading rows={4} />
      </div>
    )
  }

  if (!project.data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">
        Project not found.
      </div>
    )
  }

  return <ProjectOverview projectId={project.data.id} />
}
