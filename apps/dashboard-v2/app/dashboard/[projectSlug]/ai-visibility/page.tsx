"use client"

import {
  ChartLineUpIcon,
  CheckCircleIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react"
import { useParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  useAiVisibilityInterest,
  useMarkAiVisibilityInterest,
} from "@/query/feature-interest.query"
import { useProjectBySlug } from "@/query/project.query"

const WHAT_IT_SHOWS = [
  "Prompts that mention you",
  "Pages AI cites",
  "Competitors shown instead",
  "Gaps to repair",
]

export default function ProjectAiVisibilityPage() {
  const params = useParams<{ projectSlug: string }>()
  const project = useProjectBySlug(params.projectSlug)
  const interest = useAiVisibilityInterest()
  const markInterest = useMarkAiVisibilityInterest()
  const interested =
    !!interest.data?.interested && interest.data.projectId === project.data?.id
  const saving = interest.isLoading || markInterest.isPending

  async function onShowInterest() {
    try {
      await markInterest.mutateAsync(project.data?.id)
      toast.success("Interest saved.")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save your interest."
      )
    }
  }

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

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="AI Visibility"
        description={`${project.data.name}: coming soon.`}
      />

      <section className="mt-5 grid gap-8 bg-card p-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex min-w-0 flex-col justify-center">
          <div className="grid size-12 place-items-center bg-muted text-muted-foreground">
            <ChartLineUpIcon className="size-6" />
          </div>
          <h2 className="mt-6 max-w-2xl text-2xl font-semibold tracking-tight">
            Track the AI answers buyers see.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Sample prompts, cited URLs, and competitor mentions for this project.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              className="cursor-pointer"
              disabled={saving || interested}
              onClick={onShowInterest}
            >
              {saving ? (
                <SpinnerGapIcon className="size-4 animate-spin" />
              ) : interested ? (
                <CheckCircleIcon className="size-4" weight="fill" />
              ) : null}
              {interest.isLoading
                ? "Checking"
                : interested
                  ? "Interest saved"
                  : "Show interest"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Saves interest for {project.data.name}.
            </span>
          </div>
        </div>

        <div className="grid content-start gap-2 bg-muted p-5">
          {WHAT_IT_SHOWS.map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 bg-background px-3 py-2 text-sm"
            >
              <CheckCircleIcon className="size-4 text-muted-foreground" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 bg-muted p-5">
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Reporting will be sample-based, not guaranteed citation volume.
        </p>
      </section>
    </div>
  )
}
