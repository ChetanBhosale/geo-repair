"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2, LogOut, PanelLeft } from "lucide-react"
import type { ReactNode } from "react"
import { BrandLogo } from "@/components/brand-logo"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { useLogout, useUser } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"

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
  const router = useRouter()
  const { isSignedIn, isLoading } = useUser()
  const logout = useLogout()
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
    <div className="grid min-h-svh bg-muted/30 text-foreground lg:grid-cols-[260px_minmax(0,1fr)]">
      <DashboardSidebar
        isSignedIn={isSignedIn}
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
      />

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-18 items-center justify-between gap-4 bg-muted/30 px-4 py-3 lg:px-6">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
              {eyebrow}
            </p>
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {actions}

            <Button
              aria-label="Sign out"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
              size="icon"
              variant="ghost"
            >
              <LogOut className="size-4" />
            </Button>

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

        <main className="mx-auto grid w-full max-w-7xl gap-5 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

function DashboardLoading({ title }: { title: string }) {
  return (
    <div className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
      <div className="grid justify-items-center gap-3 text-center">
        <BrandLogo />
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>
    </div>
  )
}
