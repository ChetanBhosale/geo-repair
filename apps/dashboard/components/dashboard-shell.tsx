"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2, PanelLeft } from "lucide-react"
import type { ReactNode } from "react"
import { BrandLogo } from "@/components/brand-logo"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { useUser } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function DashboardShell({
  children,
  title,
  actions,
  fullBleed = false,
}: {
  children: ReactNode
  eyebrow?: ReactNode
  title: string
  actions?: ReactNode
  // Collapse the desktop rail and drop the centered max-width + padding so the
  // page can use the full viewport (used by the fix-agent workspace).
  fullBleed?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { isSignedIn, isLoading } = useUser()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  React.useEffect(() => {
    if (isLoading || isSignedIn) {
      return
    }

    const next =
      typeof window === "undefined"
        ? pathname
        : `${window.location.pathname}${window.location.search}`

    router.replace(`/onboarding?next=${encodeURIComponent(next)}`)
  }, [isLoading, isSignedIn, pathname, router])

  if (isLoading) {
    return <DashboardLoading title="Loading dashboard" />
  }

  if (!isSignedIn) {
    return <DashboardLoading title="Opening signup" />
  }

  return (
    <div
      className={cn(
        "grid min-h-svh bg-secondary/30 text-primary",
        fullBleed
          ? "lg:grid-cols-[64px_minmax(0,1fr)]"
          : "lg:grid-cols-[260px_minmax(0,1fr)]",
      )}
    >
      <DashboardSidebar
        collapsed={fullBleed}
        isSignedIn={isSignedIn}
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
      />

      <div className={cn("min-w-0", fullBleed && "flex h-svh flex-col")}>
        <header className="sticky top-0 z-20 flex min-h-18 items-center justify-between gap-4 border-b border-secondary bg-primary/85 px-4 py-3 backdrop-blur-md lg:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {actions}

            <Button
              aria-label="Navigation"
              aria-controls="dashboard-sidebar-mobile"
              aria-expanded={sidebarOpen}
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <PanelLeft className="size-4" />
            </Button>
          </div>
        </header>

        {fullBleed ? (
          <main className="min-h-0 flex-1">{children}</main>
        ) : (
          <main className="mx-auto grid w-full max-w-7xl gap-5 p-4 lg:p-6">
            {children}
          </main>
        )}
      </div>
    </div>
  )
}

function DashboardLoading({ title }: { title: string }) {
  return (
    <div className="grid min-h-svh place-items-center bg-primary p-6 text-primary">
      <div className="grid justify-items-center gap-3 text-center">
        <BrandLogo />
        <Loader2 className="size-5 animate-spin text-secondary" />
        <p className="text-sm text-secondary">{title}</p>
      </div>
    </div>
  )
}
