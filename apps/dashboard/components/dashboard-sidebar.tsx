"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Check,
  ChevronDown,
  CreditCard,
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
import type { BillingOrder, OrderStatus } from "@repo/types/billing"
import type { SavedRepository } from "@repo/types/github"
import { BrandLogo } from "@/components/brand-logo"
import { GithubIcon } from "@/components/icons/github-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { loginWithGithub } from "@/hooks/use-auth"
import { useBillingHistory } from "@/hooks/use-billing"
import { useSavedRepos, useSelectRepo } from "@/hooks/use-repos"
import { formatStatusLabel, orderStatusVariant } from "@/lib/dashboard-format"
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

const activeCheckoutStatuses = new Set<OrderStatus>([
  "PENDING",
  "CHECKOUT_CREATED",
  "PROCESSING",
])

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
  const billingHistory = useBillingHistory(isSignedIn)
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
    reposErrorMessage:
      savedRepos.error instanceof Error ? savedRepos.error.message : null,
    billingOrders: billingHistory.data?.orders ?? [],
    billingLoading: billingHistory.isLoading,
    billingError: billingHistory.isError,
    billingErrorMessage:
      billingHistory.error instanceof Error
        ? billingHistory.error.message
        : null,
    selectPending: selectRepo.isPending,
    onReconnectGithub() {
      loginWithGithub(currentDashboardPath(pathname))
    },
    onSelectRepo(repo: SavedRepository) {
      selectRepo.mutate(toSelectPayload(repo))
    },
  }

  return (
    <>
      <aside className="hidden bg-primary text-primary lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col">
        <SidebarContent idPrefix="desktop" {...contentProps} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-primary/80 backdrop-blur-sm"
            onClick={() => onMobileOpenChange(false)}
            type="button"
          />
          <aside
            className="relative flex h-full w-[min(82vw,20rem)] flex-col bg-primary text-primary"
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
  reposErrorMessage,
  billingOrders,
  billingLoading,
  billingError,
  billingErrorMessage,
  selectPending,
  onReconnectGithub,
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
  reposErrorMessage: string | null
  billingOrders: BillingOrder[]
  billingLoading: boolean
  billingError: boolean
  billingErrorMessage: string | null
  selectPending: boolean
  onReconnectGithub: () => void
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
          errorMessage={reposErrorMessage}
          isPending={selectPending}
          onReconnectGithub={onReconnectGithub}
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
                "flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-sm text-secondary transition-colors hover:bg-secondary hover:text-primary",
                active && "bg-secondary text-primary"
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
        {isSignedIn ? (
          <AccountPlanStatus
            orders={billingOrders}
            isLoading={billingLoading}
            isError={billingError}
            errorMessage={billingErrorMessage}
            onClose={onClose}
          />
        ) : null}

        {sidebarUtilityItems.map((item) => {
          const Icon = utilityIcons[item.label]

          return (
            <a
              key={item.href}
              href={item.href}
              className="flex min-h-9 items-center gap-2 rounded-md px-3 text-sm text-secondary transition-colors hover:bg-secondary hover:text-primary"
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

function AccountPlanStatus({
  orders,
  isLoading,
  isError,
  errorMessage,
  onClose,
}: {
  orders: BillingOrder[]
  isLoading: boolean
  isError: boolean
  errorMessage: string | null
  onClose?: () => void
}) {
  const state = getAccountPlanState({
    orders,
    isLoading,
    isError,
    errorMessage,
  })

  return (
    <Link
      aria-label={`Account plan: ${state.title}`}
      className="grid gap-2 rounded-md bg-secondary p-3 text-left transition-colors hover:bg-tertiary"
      href="/settings"
      onClick={onClose}
    >
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-secondary">
          {state.loading ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <CreditCard className="size-3.5 shrink-0" aria-hidden />
          )}
          <span className="truncate">{state.title}</span>
        </span>
        <Badge className="shrink-0" variant={state.variant}>
          {state.badge}
        </Badge>
      </span>
      {/* <span className="truncate text-sm font-medium text-primary">
        {state.title}
      </span>
      <span className="max-h-8 overflow-hidden text-xs text-secondary">
        {state.description}
      </span> */}
    </Link>
  )
}

function getAccountPlanState({
  orders,
  isLoading,
  isError,
  errorMessage,
}: {
  orders: BillingOrder[]
  isLoading: boolean
  isError: boolean
  errorMessage: string | null
}): {
  title: string
  badge: string
  description: string
  variant: React.ComponentProps<typeof Badge>["variant"]
  loading?: boolean
} {
  if (isLoading) {
    return {
      title: "Loading account",
      badge: "Checking",
      description: "Reading billing status.",
      variant: "neutral",
      loading: true,
    }
  }

  if (isError) {
    return {
      title: "Plan unavailable",
      badge: "Error",
      description: errorMessage ?? "Billing status could not be loaded.",
      variant: "fail",
    }
  }

  const paidOrder = orders.find((order) => order.status === "PAID")
  if (paidOrder) {
    return {
      title: `${formatFixTier(paidOrder.tier)} paid fix`,
      badge: "Paid",
      description: paidOrder.repoFullName ?? paidOrder.website,
      variant: "pass",
    }
  }

  const activeCheckoutOrder = orders.find((order) =>
    activeCheckoutStatuses.has(order.status)
  )
  if (activeCheckoutOrder) {
    return {
      title: `${formatFixTier(activeCheckoutOrder.tier)} checkout`,
      badge: formatStatusLabel(activeCheckoutOrder.status),
      description: activeCheckoutOrder.website,
      variant: orderStatusVariant(activeCheckoutOrder.status),
    }
  }

  return {
    title: "Free account",
    badge: "Free",
    description: "No paid fix purchased yet.",
    variant: "neutral",
  }
}

function formatFixTier(tier: BillingOrder["tier"]) {
  if (tier === "ENTERPRISE_CUSTOM") {
    return "Custom"
  }

  return tier.charAt(0) + tier.slice(1).toLowerCase()
}

function ProjectSwitcher({
  id,
  repos,
  selectedRepo,
  isLoading,
  isError,
  errorMessage,
  isPending,
  onReconnectGithub,
  onSelectRepo,
}: {
  id: string
  repos: SavedRepository[]
  selectedRepo: SavedRepository | null
  isLoading: boolean
  isError: boolean
  errorMessage: string | null
  isPending: boolean
  onReconnectGithub: () => void
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

  const dropdownId = `${id}-listbox`
  const canReconnectGithub = isGithubReconnectError(errorMessage)

  return (
    <div className="relative" ref={switcherRef}>
      {isLoading ? (
        <p className="flex min-h-16 items-center gap-2 rounded-md bg-secondary p-3 text-sm text-secondary">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading projects
        </p>
      ) : isError ? (
        <div className="grid gap-2 rounded-md bg-secondary p-3">
          <div className="grid gap-1">
            <p className="text-sm font-medium text-danger">
              Project sync failed
            </p>
            <p className="max-h-10 overflow-hidden text-xs text-secondary">
              {errorMessage ?? "Reconnect GitHub and try again."}
            </p>
          </div>
          {canReconnectGithub ? (
            <Button
              className="w-full justify-start"
              onClick={onReconnectGithub}
              size="sm"
              type="button"
              variant="outline"
            >
              <GithubIcon />
              Reconnect GitHub
            </Button>
          ) : null}
        </div>
      ) : repos.length > 0 ? (
        <>
          <button
            aria-controls={dropdownId}
            aria-expanded={open}
            aria-haspopup="listbox"
            className="grid min-h-16 w-full cursor-pointer gap-1 rounded-md bg-secondary p-3 text-left transition-colors outline-none hover:bg-secondary focus-visible:ring-1 focus-visible:ring-focus/50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            id={id}
            onClick={() => setOpen((current) => !current)}
            type="button"
          >
            {/* <span className="text-xs font-medium text-secondary">
              Active project
            </span> */}
            <span className="flex min-w-0 items-center justify-between gap-2 text-sm text-primary">
              <span className="min-w-0 truncate">
                {selectedRepo?.fullName ?? "Choose project"}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-secondary transition-transform",
                  open && "rotate-180"
                )}
                aria-hidden
              />
            </span>
            {selectedRepo ? (
              <span>
                <span className="truncate text-xs text-secondary">
                  {selectedRepo.website ?? selectedRepo.defaultBranch}
                </span>
                {/* <Badge className="shrink-0" variant={state.variant}>
                  {state.badge}
                </Badge> */}
              </span>
            ) : null}
          </button>

          {open ? (
            <div
              aria-labelledby={id}
              className="absolute top-full right-0 left-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-md bg-tertiary py-1"
              id={dropdownId}
              role="listbox"
            >
              {repos.map((repo) => {
                const selected = repo.id === selectedRepo?.id

                return (
                  <button
                    aria-selected={selected}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
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
                      <span className="block truncate text-xs text-secondary">
                        {repo.website ?? repo.defaultBranch}
                      </span>
                    </span>
                    {selected ? (
                      <Check className="size-4 shrink-0 text-brand" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-md bg-secondary p-3 text-sm text-secondary">
          No repository selected
        </p>
      )}
    </div>
  )
}

function currentDashboardPath(pathname: string) {
  if (typeof window === "undefined") {
    return pathname
  }

  return `${window.location.pathname}${window.location.search}`
}

function isGithubReconnectError(message: string | null) {
  return !!message && /github|auth|token|session|not connected/i.test(message)
}
