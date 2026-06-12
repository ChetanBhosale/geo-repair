"use client"

import * as React from "react"
import { MagnifyingGlassIcon, LockIcon } from "@phosphor-icons/react"
import type { GithubRepo } from "@repo/types/github"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useGithubRepos, useCreateProject } from "@/query/project.query"
import { CreateProjectRequestSchema } from "@repo/types/project"

export function CreateProjectDialog({
  open,
  onOpenChange,
  initialWebsite,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialWebsite?: string | null
}) {
  const repos = useGithubRepos(open)
  const createProject = useCreateProject()
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<GithubRepo | null>(null)
  const [website, setWebsite] = React.useState(() =>
    websiteInputFromUrl(initialWebsite)
  )
  const [fieldError, setFieldError] = React.useState<string | null>(null)

  function reset() {
    setSearch("")
    setSelected(null)
    setWebsite("")
    setFieldError(null)
    createProject.reset()
  }

  const filtered = React.useMemo(() => {
    const list = repos.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) => r.fullName.toLowerCase().includes(q))
  }, [repos.data, search])

  function onCreate() {
    setFieldError(null)

    // Repo selection is required.
    if (!selected) {
      setFieldError("Choose a repository to continue.")
      return
    }

    // The field holds the domain only; prepend the fixed https:// scheme.
    const websiteUrl = `https://${website.trim()}`

    // Validate the whole payload with the shared zod schema (website required).
    const parsed = CreateProjectRequestSchema.safeParse({
      githubRepoId: selected.id,
      name: selected.name,
      fullName: selected.fullName,
      owner: selected.owner.login,
      private: selected.private,
      htmlUrl: selected.htmlUrl,
      cloneUrl: selected.cloneUrl,
      defaultBranch: selected.defaultBranch,
      description: selected.description,
      language: selected.language,
      websiteUrl,
    })

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      setFieldError(issue?.message ?? "Please check the form and try again.")
      return
    }

    createProject.mutate(parsed.data, {
      onSuccess: () => {
        reset()
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Pick the GitHub repository that builds your site.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <MagnifyingGlassIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search repositories"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          {repos.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading repositories…</p>
          ) : repos.isError ? (
            <p className="p-4 text-sm text-destructive">
              {(repos.error as Error).message}
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No repositories found.</p>
          ) : (
            filtered.map((repo) => (
              <button
                key={repo.id}
                type="button"
                onClick={() => setSelected(repo)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent/60",
                  selected?.id === repo.id && "bg-accent"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{repo.fullName}</span>
                  {repo.private ? (
                    <LockIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                </span>
                {repo.language ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {repo.language}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>

        <div className="grid gap-1.5">
          <label className="text-xs text-muted-foreground">
            Website URL <span className="text-destructive">*</span>
          </label>
          <div className="flex items-center rounded-md border border-input bg-transparent text-sm shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <span className="select-none pl-3 text-muted-foreground">
              https://
            </span>
            <input
              inputMode="url"
              placeholder="example.com"
              className="h-9 flex-1 bg-transparent py-1 pr-3 pl-1 outline-none placeholder:text-muted-foreground"
              value={website}
              onChange={(e) => setWebsite(stripProtocol(e.target.value))}
            />
          </div>
        </div>

        {fieldError ? (
          <p className="text-sm text-destructive">{fieldError}</p>
        ) : createProject.isError ? (
          <p className="text-sm text-destructive">
            {(createProject.error as Error).message}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selected || !website.trim() || createProject.isPending}
            onClick={onCreate}
          >
            {createProject.isPending ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// The field stores the domain only (the UI shows a fixed https:// prefix). If a
// user pastes a value that already has http(s)://, strip it so we never end up
// with https://https://example.com.
function stripProtocol(value: string): string {
  return value.replace(/^\s*https?:\/\//i, "").replace(/^\s+/, "")
}

function websiteInputFromUrl(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return ""

  try {
    const parsed = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    )
    return parsed.hostname
  } catch {
    return stripProtocol(trimmed).split(/[/?#]/)[0] ?? ""
  }
}
