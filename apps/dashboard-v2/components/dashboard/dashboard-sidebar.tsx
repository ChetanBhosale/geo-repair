"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChartLineUpIcon,
  CreditCardIcon,
  GearSixIcon,
  LifebuoyIcon,
  ListChecksIcon,
  RobotIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react"
import type { Project } from "@repo/types/project"

import { cn } from "@/lib/utils"
import { selectedProjectForDashboardPath } from "@/lib/project-selection"
import {
  projectAiVisibilityPath,
  projectFixAgentPath,
  projectOverviewPath,
  projectScansPath,
  projectSettingsPath,
  projectSupportPath,
  projectUsagePath,
} from "@/lib/project-routes"
import { useProjects, useSelectedProject } from "@/query/project.query"

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string; weight?: "fill" | "regular" }>
}

function navForProject(project: Project): NavItem[] {
  return [
    {
      label: "Overview",
      href: projectOverviewPath(project),
      icon: SquaresFourIcon,
    },
    {
      label: "AI Visibility",
      href: projectAiVisibilityPath(project),
      icon: ChartLineUpIcon,
    },
    {
      label: "Fix Agent",
      href: projectFixAgentPath(project),
      icon: RobotIcon,
    },
    {
      label: "Scans",
      href: projectScansPath(project),
      icon: ListChecksIcon,
    },
    {
      label: "Usage",
      href: projectUsagePath(project),
      icon: CreditCardIcon,
    },
    {
      label: "Settings",
      href: projectSettingsPath(project),
      icon: GearSixIcon,
    },
    {
      label: "Support",
      href: projectSupportPath(project),
      icon: LifebuoyIcon,
    },
  ]
}

export function DashboardSidebar() {
  const pathname = usePathname()
  const projects = useProjects()
  const selectedQuery = useSelectedProject()
  const selected = selectedProjectForDashboardPath(
    projects.data ?? [],
    selectedQuery.data ?? null,
    pathname
  )
  const nav = selected ? navForProject(selected) : []

  return (
    <aside className="sticky top-14 flex h-[calc(100svh-3.5rem)] w-56 shrink-0 flex-col bg-sidebar px-3 py-4">
      <nav className="flex-1 overflow-y-auto">
        <div className="space-y-1">
          {nav.length > 0 ? (
            nav.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))
          ) : (
            <Link
              href="/dashboard/projects"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <SquaresFourIcon className="size-4" />
              Projects
            </Link>
          )}
        </div>
      </nav>
    </aside>
  )
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active =
    pathname === item.href ||
    (item.href.includes("/fix-agent") && pathname.startsWith(item.href))
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-secondary font-medium text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
    >
      <Icon className="size-4" weight={active ? "fill" : "regular"} />
      {item.label}
    </Link>
  )
}
