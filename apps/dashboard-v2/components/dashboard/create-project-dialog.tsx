"use client"

import * as React from "react"
import { CheckIcon, MagnifyingGlassIcon, LockIcon } from "@phosphor-icons/react"
import type { GithubRepo } from "@repo/types/github"
import type { Project } from "@repo/types/project"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import {
  findAutoCreateRepoForWebsite,
  stripProtocol,
  websiteInputFromUrl,
} from "@/lib/project-handoff"

export function CreateProjectDialog({
  open,
  onOpenChange,
  initialWebsite,
  autoCreate = false,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialWebsite?: string | null
  autoCreate?: boolean
  onCreated?: (project: Project) => void
}) {
  const repos = useGithubRepos(open)
  const createProject = useCreateProject()
  const autoCreateKey = React.useRef<string | null>(null)
  const repoPickerRef = React.useRef<HTMLDivElement | null>(null)
  const repoListboxId = React.useId()
  const [search, setSearch] = React.useState("")
  const [repoDropdownOpen, setRepoDropdownOpen] = React.useState(true)
  const [selected, setSelected] = React.useState<GithubRepo | null>(null)
  const [activeRepoId, setActiveRepoId] = React.useState<number | null>(null)
  const [website, setWebsite] = React.useState(() =>
    websiteInputFromUrl(initialWebsite)
  )
  const [fieldError, setFieldError] = React.useState<string | null>(null)

  const reset = React.useCallback(() => {
    setSearch("")
    setRepoDropdownOpen(true)
    setSelected(null)
    setActiveRepoId(null)
    setWebsite("")
    setFieldError(null)
    autoCreateKey.current = null
    createProject.reset()
  }, [createProject])

  const filtered = React.useMemo(() => {
    const list = repos.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((r) => r.fullName.toLowerCase().includes(q))
  }, [repos.data, search])

  const activeRepo = React.useMemo(
    () => filtered.find((repo) => repo.id === activeRepoId) ?? null,
    [activeRepoId, filtered]
  )

  const onRepoSearchChange = React.useCallback((value: string) => {
    setSearch(value)
    setSelected(null)
    setActiveRepoId(null)
    setRepoDropdownOpen(true)
    setFieldError(null)
  }, [])

  const selectRepo = React.useCallback((repo: GithubRepo) => {
    setSelected(repo)
    setActiveRepoId(repo.id)
    setSearch(repo.fullName)
    setRepoDropdownOpen(false)
    setFieldError(null)
  }, [])

  function moveActiveRepo(direction: 1 | -1) {
    if (filtered.length === 0) return

    const currentIndex = filtered.findIndex((repo) => repo.id === activeRepoId)
    const selectedIndex = selected
      ? filtered.findIndex((repo) => repo.id === selected.id)
      : -1
    const startIndex = currentIndex >= 0 ? currentIndex : selectedIndex
    const nextIndex =
      direction === 1
        ? (startIndex + 1) % filtered.length
        : (startIndex - 1 + filtered.length) % filtered.length

    setActiveRepoId(filtered[nextIndex]?.id ?? null)
  }

  function onRepoInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setRepoDropdownOpen(true)
      moveActiveRepo(1)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setRepoDropdownOpen(true)
      moveActiveRepo(-1)
      return
    }

    if (event.key === "Home" && repoDropdownOpen && filtered.length > 0) {
      event.preventDefault()
      setActiveRepoId(filtered[0]?.id ?? null)
      return
    }

    if (event.key === "End" && repoDropdownOpen && filtered.length > 0) {
      event.preventDefault()
      setActiveRepoId(filtered.at(-1)?.id ?? null)
      return
    }

    if (event.key === "Enter" && repoDropdownOpen) {
      const repo = activeRepo ?? filtered[0]
      if (repo) {
        event.preventDefault()
        selectRepo(repo)
      }
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      setRepoDropdownOpen(false)
    }
  }

  const onRepoPickerBlur = React.useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const nextFocus = event.relatedTarget
      if (
        nextFocus instanceof Node &&
        event.currentTarget.contains(nextFocus)
      ) {
        return
      }
      setRepoDropdownOpen(false)
    },
    []
  )

  React.useEffect(() => {
    if (!open || !repoDropdownOpen) return

    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (target instanceof Node && repoPickerRef.current?.contains(target)) {
        return
      }
      setRepoDropdownOpen(false)
    }

    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open, repoDropdownOpen])

  const createFromRepo = React.useCallback(
    (repo: GithubRepo) => {
      setFieldError(null)

      // The field holds the domain only; prepend the fixed https:// scheme.
      const websiteUrl = `https://${website.trim()}`

      // Validate the whole payload with the shared zod schema (website required).
      const parsed = CreateProjectRequestSchema.safeParse({
        githubRepoId: repo.id,
        name: repo.name,
        fullName: repo.fullName,
        owner: repo.owner.login,
        private: repo.private,
        htmlUrl: repo.htmlUrl,
        cloneUrl: repo.cloneUrl,
        defaultBranch: repo.defaultBranch,
        description: repo.description,
        language: repo.language,
        websiteUrl,
      })

      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        setFieldError(issue?.message ?? "Please check the form and try again.")
        return
      }

      createProject.mutate(parsed.data, {
        onSuccess: (project) => {
          onCreated?.(project)
          reset()
          onOpenChange(false)
        },
      })
    },
    [createProject, onCreated, onOpenChange, reset, website]
  )

  function onCreate() {
    // Repo selection is required.
    if (!selected) {
      setFieldError("Choose a repository to continue.")
      return
    }

    createFromRepo(selected)
  }

  React.useEffect(() => {
    if (
      !autoCreate ||
      !open ||
      repos.isLoading ||
      repos.isError ||
      createProject.isPending
    ) {
      return
    }

    const repo = findAutoCreateRepoForWebsite(
      initialWebsite ?? website,
      repos.data ?? []
    )
    if (!repo) return

    const key = `${website}:${repo.id}`
    if (autoCreateKey.current === key) return

    autoCreateKey.current = key
    selectRepo(repo)
    createFromRepo(repo)
  }, [
    autoCreate,
    createProject.isPending,
    initialWebsite,
    open,
    repos.data,
    repos.isError,
    repos.isLoading,
    website,
    createFromRepo,
    selectRepo,
  ])

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

        <div ref={repoPickerRef} onBlur={onRepoPickerBlur}>
          <div
            className={cn(
              "relative flex h-10 items-center rounded-md border border-input bg-background text-sm transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
              repoDropdownOpen && "rounded-b-none"
            )}
          >
            <MagnifyingGlassIcon className="ml-2.5 size-4 shrink-0 text-muted-foreground" />
            <input
              role="combobox"
              aria-controls={repoListboxId}
              aria-expanded={repoDropdownOpen}
              aria-autocomplete="list"
              aria-activedescendant={
                repoDropdownOpen && activeRepo
                  ? repoOptionId(repoListboxId, activeRepo.id)
                  : undefined
              }
              className="h-full min-w-0 flex-1 bg-transparent px-2 outline-none placeholder:text-muted-foreground"
              placeholder="Search repositories"
              value={search}
              onChange={(event) => onRepoSearchChange(event.target.value)}
              onFocus={() => {
                setRepoDropdownOpen(true)
                setActiveRepoId((current) => current ?? selected?.id ?? null)
              }}
              onKeyDown={onRepoInputKeyDown}
            />
            {selected ? (
              <CheckIcon className="mr-2.5 size-4 shrink-0 text-primary" />
            ) : null}
          </div>

          {repoDropdownOpen ? (
            <div
              id={repoListboxId}
              role="listbox"
              className="-mt-px max-h-64 overflow-y-auto rounded-b-md border border-input bg-popover"
            >
              {repos.isLoading ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Loading repositories…
                </p>
              ) : repos.isError ? (
                <p className="p-4 text-sm text-destructive">
                  {(repos.error as Error).message}
                </p>
              ) : filtered.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No repositories found.
                </p>
              ) : (
                filtered.map((repo) => {
                  const isSelected = selected?.id === repo.id
                  const isActive = activeRepoId === repo.id

                  return (
                    <button
                      key={repo.id}
                      id={repoOptionId(repoListboxId, repo.id)}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectRepo(repo)}
                      onMouseEnter={() => setActiveRepoId(repo.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/60",
                        isActive && "bg-accent/70",
                        isSelected && "bg-accent"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">
                          {repo.fullName}
                        </span>
                        {repo.private ? (
                          <LockIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {repo.language ? (
                          <span className="text-xs text-muted-foreground">
                            {repo.language}
                          </span>
                        ) : null}
                        {isSelected ? (
                          <CheckIcon className="size-4 text-primary" />
                        ) : null}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <label className="text-xs text-muted-foreground">
            Website URL <span className="text-destructive">*</span>
          </label>
          <div className="flex items-center rounded-md border border-input bg-transparent text-sm shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <span className="pl-3 text-muted-foreground select-none">
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

function repoOptionId(listboxId: string, repoId: number): string {
  return `${listboxId}-repo-${repoId}`
}
