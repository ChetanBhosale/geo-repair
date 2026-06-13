"use client"

import { useParams } from "next/navigation"
import { EnvelopeSimpleIcon, LifebuoyIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { PageHeader } from "@/components/dashboard/page-header"
import { useProjectBySlug } from "@/query/project.query"

export default function ProjectSupportPage() {
  const params = useParams<{ projectSlug: string }>()
  const project = useProjectBySlug(params.projectSlug)

  if (project.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <DashboardInlineLoading rows={3} />
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

  const subject = encodeURIComponent(`Support for ${project.data.fullName}`)

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader title="Support" description={project.data.name} />
      <div className="mt-5 grid place-items-center bg-card px-6 py-20 text-center">
        <div className="grid size-12 place-items-center bg-muted text-muted-foreground">
          <LifebuoyIcon className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-semibold">Need a hand?</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Include what you were trying to do.
        </p>
        <Button className="mt-5 cursor-pointer" asChild>
          <a href={`mailto:support@geo.repair?subject=${subject}`}>
            <EnvelopeSimpleIcon className="size-4" />
            Contact support
          </a>
        </Button>
      </div>
    </div>
  )
}
