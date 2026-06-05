"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  GitBranch,
  LifeBuoy,
  LogOut,
  MessageSquareText,
  PanelLeft,
} from "lucide-react"
import type { ReactNode } from "react"
import type { SavedRepository } from "@repo/types/github"
import { loginWithGithub, useLogout, useUser } from "@/hooks/use-auth"
import { useSavedRepos, useSelectRepo } from "@/hooks/use-repos"
import { navItems, sidebarUtilityItems } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const utilityIcons = {
  "Contact support": LifeBuoy,
  "Submit feedback": MessageSquareText,
} as const

function toSelectPayload(repo: SavedRepository) {
  return {
    cloneUrl: repo.cloneUrl,
    defaultBranch: repo.defaultBranch,
    description: repo.description,
    fullName: repo.fullName,
    githubRepoId: repo.githubRepoId,
    htmlUrl: repo.htmlUrl,
    language: repo.language,
    name: repo.name,
    owner: repo.owner,
    private: repo.private,
  }
}

export function DashboardShell({
  children,
  eyebrow,
  title,
  actions,
}: {
  children: ReactNode
  eyebrow: string
  title: string
  actions?: ReactNode
}) {
  const pathname = usePathname()
  const { isSignedIn, isLoading } = useUser()
  const logout = useLogout()
  const savedRepos = useSavedRepos(isSignedIn)
  const selectRepo = useSelectRepo()
  const repos = savedRepos.data ?? []
  const selectedRepo = repos.find((repo) => repo.selected) ?? repos[0] ?? null

  return (
    <div className="grid min-h-svh bg-background text-foreground lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex border-b border-border bg-card lg:sticky lg:top-0 lg:h-svh lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex w-full flex-col gap-5 p-4">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="AI Search dashboard home"
          >
            <span className="grid size-9 place-items-center rounded-lg border border-border bg-primary text-xs font-bold text-primary-foreground">
              AI
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                AI Search
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Dashboard
              </span>
            </span>
          </Link>

          <nav className="grid gap-1" aria-label="Dashboard navigation">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg border border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground",
                    active && "border-border bg-muted text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="mt-auto hidden gap-2 lg:grid">
            {sidebarUtilityItems.map((item) => {
              const Icon = utilityIcons[item.label]

              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex min-h-9 items-center gap-2 rounded-lg border border-transparent px-3 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </a>
              )
            })}
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-18 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:px-6">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
              {eyebrow}
            </p>
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {isSignedIn && repos.length > 0 ? (
              <label className="hidden min-w-56 gap-1 text-xs text-muted-foreground sm:grid">
                <span>Project</span>
                <select
                  className="h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring"
                  disabled={selectRepo.isPending}
                  onChange={(event) => {
                    const next = repos.find(
                      (repo) => repo.id === event.target.value
                    )
                    if (next) {
                      selectRepo.mutate(toSelectPayload(next))
                    }
                  }}
                  value={selectedRepo?.id ?? ""}
                >
                  {repos.map((repo) => (
                    <option key={repo.id} value={repo.id}>
                      {repo.fullName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {actions}

            {!isLoading && !isSignedIn ? (
              <Button onClick={loginWithGithub} variant="outline">
                <GitBranch className="size-4" />
                Connect GitHub
              </Button>
            ) : null}

            {isSignedIn ? (
              <Button
                aria-label="Sign out"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
                size="icon"
                variant="ghost"
              >
                <LogOut className="size-4" />
              </Button>
            ) : null}

            <Button
              aria-label="Navigation"
              className="lg:hidden"
              size="icon"
              variant="ghost"
            >
              <PanelLeft className="size-4" />
            </Button>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-7xl gap-5 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
