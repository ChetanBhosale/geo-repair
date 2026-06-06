"use client"

import * as React from "react"
import { Check, Loader2, Lock, Search } from "lucide-react"
import type { GithubRepo, SavedRepository } from "@repo/types/github"
import { useRepos, useSelectRepo } from "@/hooks/use-repos"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function RepoPicker({
  onSelected,
}: {
  onSelected?: (repo: SavedRepository) => void
}) {
  const [search, setSearch] = React.useState("")
  const { data: repos, isLoading, isError, error } = useRepos(true)
  const selectRepo = useSelectRepo()
  const [savedId, setSavedId] = React.useState<number | null>(null)

  const filtered = React.useMemo(() => {
    const list = repos ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q)
    )
  }, [repos, search])

  function onPick(repo: GithubRepo) {
    selectRepo.mutate(
      {
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
      },
      {
        onSuccess: (saved) => {
          setSavedId(repo.id)
          onSelected?.(saved)
        },
      }
    )
  }

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-secondary">
        <Loader2 className="size-4 animate-spin" />
        Loading your repositories.
      </p>
    )
  }

  if (isError) {
    return <p className="text-sm text-danger">{(error as Error).message}</p>
  }

  const pendingId = selectRepo.isPending
    ? selectRepo.variables?.githubRepoId
    : null

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-secondary" />
        <Input
          placeholder="Search repositories"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-secondary">No repositories found.</p>
        ) : (
          filtered.map((repo) => {
            const isSaved = savedId === repo.id
            const isPending = pendingId === repo.id
            return (
              <button
                key={repo.id}
                type="button"
                onClick={() => onPick(repo)}
                disabled={selectRepo.isPending}
                className={cn(
                  "flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary disabled:opacity-60",
                  isSaved && "bg-secondary"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {repo.fullName}
                    </span>
                    {repo.private ? (
                      <Lock className="size-3.5 shrink-0 text-secondary" />
                    ) : null}
                  </div>
                  {repo.description ? (
                    <p className="mt-0.5 truncate text-xs text-secondary">
                      {repo.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {repo.language ? (
                    <Badge variant="neutral">{repo.language}</Badge>
                  ) : null}
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin text-secondary" />
                  ) : isSaved ? (
                    <Badge variant="pass">
                      <Check className="size-3" />
                      Selected
                    </Badge>
                  ) : null}
                </div>
              </button>
            )
          })
        )}
      </div>

      {selectRepo.isError ? (
        <p className="text-sm text-danger">
          {(selectRepo.error as Error).message}
        </p>
      ) : null}
    </div>
  )
}
