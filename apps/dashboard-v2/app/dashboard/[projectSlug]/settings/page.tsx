"use client"

import { useParams, useRouter } from "next/navigation"
import { TrashIcon } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { PageHeader } from "@/components/dashboard/page-header"
import { useDeleteProject, useProjectBySlug } from "@/query/project.query"

export default function ProjectSettingsPage() {
  const params = useParams<{ projectSlug: string }>()
  const router = useRouter()
  const project = useProjectBySlug(params.projectSlug)
  const deleteProject = useDeleteProject()

  async function onDelete() {
    if (!project.data) return
    try {
      await deleteProject.mutateAsync(project.data.id)
      router.push("/dashboard/projects")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete project.")
    }
  }

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

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader title="Settings" description={project.data.name} />

      <div className="mt-5 grid gap-2 bg-secondary p-2">
        <Setting label="URL slug" value={project.data.slug} />
        <Setting label="Repository" value={project.data.fullName} />
        <Setting label="Website" value={project.data.websiteUrl ?? "Not set"} />
        <Setting label="Default branch" value={project.data.defaultBranch} />
      </div>

      <div className="mt-5 bg-card p-5">
        <h2 className="text-sm font-medium">Danger zone</h2>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">
          Delete this project and its scans. Active runs must finish first.
        </p>
        <Button
          variant="destructive"
          className="mt-4 cursor-pointer"
          disabled={deleteProject.isPending}
          onClick={onDelete}
        >
          <TrashIcon className="size-4" />
          Delete project
        </Button>
      </div>
    </div>
  )
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 bg-card px-4 py-3 text-sm sm:grid-cols-[180px_1fr]">
      <p className="text-muted-foreground">{label}</p>
      <p className="min-w-0 break-words font-medium">{value}</p>
    </div>
  )
}
