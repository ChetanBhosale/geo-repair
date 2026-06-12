"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  GithubLogoIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@phosphor-icons/react"
import type { Project } from "@repo/types/project"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loginWithGithub } from "@/hooks/use-auth"
import { useIsGithubConnected, useProjects } from "@/query/project.query"
import { useWorkerStatus } from "@/context/worker-status"
import { useBreadcrumbs } from "@/context/breadcrumb"
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog"
import { ProjectFavicon } from "@/components/dashboard/project-favicon"
import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"

export default function ProjectsPage() {
  useBreadcrumbs([{ label: "Projects" }])
  const router = useRouter()
  const searchParams = useSearchParams()
  const websiteParam = searchParams.get("website")
  const github = useIsGithubConnected()
  const projects = useProjects(github.isConnected)
  const [search, setSearch] = React.useState("")
  const [manualCreateOpen, setManualCreateOpen] = React.useState(false)
  const [dismissedHandoffWebsite, setDismissedHandoffWebsite] = React.useState<
    string | null
  >(null)
  const handoffWebsite =
    github.isConnected &&
    websiteParam &&
    dismissedHandoffWebsite !== websiteParam
      ? websiteParam
      : null
  const createOpen = manualCreateOpen || !!handoffWebsite
  const initialWebsite = handoffWebsite
  const currentPath = React.useMemo(() => {
    const query = searchParams.toString()
    return `/dashboard/projects${query ? `?${query}` : ""}`
  }, [searchParams])

  const filtered = React.useMemo(() => {
    const list = projects.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        (p.websiteUrl ?? "").toLowerCase().includes(q)
    )
  }, [projects.data, search])

  function openBlankCreateDialog() {
    setManualCreateOpen(true)
  }

  function onCreateOpenChange(next: boolean) {
    if (!next && handoffWebsite) {
      setDismissedHandoffWebsite(handoffWebsite)
    }
    setManualCreateOpen(next)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      {github.isLoading ? (
        <DashboardInlineLoading rows={3} />
      ) : github.isConnected ? (
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="relative w-72 max-w-[55vw]">
            <MagnifyingGlassIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-8"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={openBlankCreateDialog}>
            <PlusIcon className="size-4" />
            Add New
          </Button>
        </div>
      ) : null}

      {github.isLoading ? null : !github.isConnected ? (
        <ConnectGithub redirectTo={currentPath} />
      ) : projects.isLoading ? (
        <DashboardInlineLoading rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CreateProjectCard
            firstProject={(projects.data?.length ?? 0) === 0}
            onClick={openBlankCreateDialog}
          />
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <CreateProjectDialog
        key={initialWebsite ?? "blank"}
        open={createOpen}
        initialWebsite={initialWebsite}
        autoCreate={!!handoffWebsite}
        onCreated={(project) => {
          if (handoffWebsite) {
            router.replace(`/dashboard/projects/${project.id}`)
          }
        }}
        onOpenChange={onCreateOpenChange}
      />
    </div>
  )
}

function ConnectGithub({ redirectTo }: { redirectTo: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-20 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <GithubLogoIcon className="size-6" />
      </div>
      <h2 className="mt-4 text-base font-semibold">Connect your GitHub</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Connect GitHub so we can read the repository that builds your site and
        open a fix PR. Only the repo you pick is touched.
      </p>
      <Button className="mt-5" onClick={() => loginWithGithub(redirectTo)}>
        <GithubLogoIcon className="size-4" />
        Connect with GitHub
      </Button>
    </div>
  )
}

function CreateProjectCard({
  firstProject,
  onClick,
}: {
  firstProject: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[128px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/40 p-5 text-center transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground">
        <PlusIcon className="size-4" />
      </div>
      <span className="text-sm font-medium">
        {firstProject ? "Create your first project" : "Create project"}
      </span>
      <span className="text-xs text-muted-foreground">
        Pick a repo and add your website
      </span>
    </button>
  )
}

function ProjectCard({ project }: { project: Project }) {
  // Small per-project running indicator, fed by the shared worker-status poll.
  const live = useWorkerStatus(project.id)
  const running = live.hasActive

  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="group flex min-h-[128px] flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/20"
    >
      <div className="flex items-center gap-2.5">
        <ProjectFavicon src={project.faviconUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {project.fullName}
          </p>
        </div>
        {running ? (
          <span
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
            title="A scan is running"
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
            </span>
            Running
          </span>
        ) : null}
      </div>

      <p className="truncate text-xs text-muted-foreground">
        {project.websiteUrl ?? "No website set"}
      </p>

      <div className="mt-auto flex items-center gap-2">
        {project.language ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">
            {project.language}
          </span>
        ) : null}
        {project.websiteVerified ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
            Verified
          </span>
        ) : null}
      </div>
    </Link>
  )
}
