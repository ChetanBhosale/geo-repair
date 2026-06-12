"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CaretRightIcon } from "@phosphor-icons/react"

import { ThemeToggle } from "@/components/theme-toggle"
import { useBreadcrumbState, type Crumb } from "@/context/breadcrumb"

const STATIC_LABELS: Record<string, string> = {
  projects: "Projects",
  "ai-visibility": "AI Visibility",
  purchase: "Purchase",
  support: "Support",
}

function deriveFromPath(pathname: string): Crumb[] {
  const seg = pathname.split("/").filter(Boolean) // ["dashboard", "projects", ...]
  const last = seg[1]
  if (last && STATIC_LABELS[last]) return [{ label: STATIC_LABELS[last] }]
  return [{ label: "Dashboard" }]
}

export function DashboardHeader() {
  const pathname = usePathname()
  const { items } = useBreadcrumbState()
  const crumbs = items ?? deriveFromPath(pathname)

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-5 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 ? (
                <CaretRightIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
              ) : null}
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  className={
                    last
                      ? "truncate font-medium text-foreground"
                      : "truncate text-muted-foreground"
                  }
                >
                  {c.label}
                </span>
              )}
            </span>
          )
        })}
      </nav>

      <ThemeToggle />
    </header>
  )
}
