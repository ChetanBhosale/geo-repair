"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Check,
  ChevronDown,
  FileText,
  Gauge,
  LifeBuoy,
  Loader2,
  MessageSquareText,
  ScanSearch,
  Settings,
  Wrench,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { SavedRepository } from "@repo/types/github"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { useSavedRepos, useSelectRepo } from "@/hooks/use-repos"
import { navItems, sidebarUtilityItems } from "@/lib/navigation"
import { cn } from "@/lib/utils"

type NavLabel = (typeof navItems)[number]["label"]
type UtilityLabel = (typeof sidebarUtilityItems)[number]["label"]

const navIcons: Record<NavLabel, LucideIcon> = {
  Dashboard: Gauge,
  "Website Scan": ScanSearch,
  "Fix Agent": Wrench,
  Reports: FileText,
  Settings,
}

const utilityIcons: Record<UtilityLabel, LucideIcon> = {
  "Contact support": LifeBuoy,
  "Submit feedback": MessageSquareText,
}

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
    website: repo.website,
  }
}

export function DashboardSidebar({
  isSignedIn,
  mobileOpen,
  onMobileOpenChange,
}: {
  isSignedIn: boolean
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}) {
  const pathname = usePathname()
  const savedRepos = useSavedRepos(isSignedIn)
  const selectRepo = useSelectRepo()
  const repos = savedRepos.data ?? []
  const selectedRepo = repos.find((repo) => repo.selected) ?? repos[0] ?? null

  const contentProps = {
    isSignedIn,
    pathname,
    repos,
    selectedRepo,
    reposLoading: savedRepos.isLoading,
    reposError: savedRepos.isError,
    selectPending: selectRepo.isPending,
    onSelectRepo(repo: SavedRepository) {
      selectRepo.mutate(toSelectPayload(repo))
    },
  }

  return (
    <>
      <aside className="hidden bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col">
        <SidebarContent idPrefix="desktop" {...contentProps} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => onMobileOpenChange(false)}
            type="button"
          />
          <aside
            className="relative flex h-full w-[min(82vw,20rem)] flex-col bg-sidebar text-sidebar-foreground"
            id="dashboard-sidebar-mobile"
          >
            <SidebarContent
              idPrefix="mobile"
              onClose={() => onMobileOpenChange(false)}
              {...contentProps}
            />
          </aside>
        </div>
      ) : null}
    </>
  )
}

function SidebarContent({
  idPrefix,
  isSignedIn,
  pathname,
  repos,
  selectedRepo,
  reposLoading,
  reposError,
  selectPending,
  onSelectRepo,
  onClose,
}: {
  idPrefix: string
  isSignedIn: boolean
  pathname: string
  repos: SavedRepository[]
  selectedRepo: SavedRepository | null
  reposLoading: boolean
  reposError: boolean
  selectPending: boolean
  onSelectRepo: (repo: SavedRepository) => void
  onClose?: () => void
}) {
  return (
    <div className="flex min-h-full w-full flex-col gap-5 p-4 lg:min-h-svh">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3"
          aria-label="AI Search dashboard home"
          onClick={onClose}
        >
          <BrandLogo />
        </Link>

        {onClose ? (
          <Button
            aria-label="Close navigation"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      {isSignedIn ? (
        <ProjectSwitcher
          id={`${idPrefix}-project-switcher`}
          repos={repos}
          selectedRepo={selectedRepo}
          isLoading={reposLoading}
          isError={reposError}
          isPending={selectPending}
          onSelectRepo={onSelectRepo}
        />
      ) : null}

      <nav className="grid gap-1" aria-label="Dashboard navigation">
        {navItems.map((item) => {
          const Icon = navIcons[item.label]
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              onClick={onClose}
            >
              <Icon className="size-4" aria-hidden />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto grid gap-2">
        {sidebarUtilityItems.map((item) => {
          const Icon = utilityIcons[item.label]

          return (
            <a
              key={item.href}
              href={item.href}
              className="flex min-h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={onClose}
            >
              <Icon className="size-4" aria-hidden />
              <span className="truncate">{item.label}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}

function ProjectSwitcher({
  id,
  repos,
  selectedRepo,
  isLoading,
  isError,
  isPending,
  onSelectRepo,
}: {
  id: string
  repos: SavedRepository[]
  selectedRepo: SavedRepository | null
  isLoading: boolean
  isError: boolean
  isPending: boolean
  onSelectRepo: (repo: SavedRepository) => void
}) {
  const [open, setOpen] = React.useState(false)
  const switcherRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (
        switcherRef.current &&
        !switcherRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  function onSelect(repo: SavedRepository) {
    onSelectRepo(repo)
    setOpen(false)
  }

  return (
    <div
      className="relative grid gap-1 rounded-md bg-sidebar-accent p-3"
      ref={switcherRef}
    >
      <p
        className="text-xs font-medium text-muted-foreground"
        id={`${id}-label`}
      >
        Active project
      </p>

      {isLoading ? (
        <p className="flex min-h-9 items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading projects
        </p>
      ) : isError ? (
        <p className="text-sm text-destructive">Projects unavailable</p>
      ) : repos.length > 0 ? (
        <div className="relative">
          <button
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-labelledby={`${id}-label ${id}`}
            className="flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-md bg-sidebar px-2 text-left text-sm text-foreground transition-colors outline-none hover:bg-background focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            id={id}
            onClick={() => setOpen((current) => !current)}
            type="button"
          >
            <span className="min-w-0 truncate">
              {selectedRepo?.fullName ?? "Choose project"}
            </span>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
              aria-hidden
            />
          </button>

          {open ? (
            <div
              aria-labelledby={`${id}-label`}
              className="absolute top-full right-0 left-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-md bg-sidebar-accent py-1"
              role="listbox"
            >
              {repos.map((repo) => {
                const selected = repo.id === selectedRepo?.id

                return (
                  <button
                    aria-selected={selected}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isPending}
                    key={repo.id}
                    onClick={() => onSelect(repo)}
                    role="option"
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {repo.fullName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {repo.website ?? repo.defaultBranch}
                      </span>
                    </span>
                    {selected ? (
                      <Check className="size-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No repository selected</p>
      )}
    </div>
  )
}
