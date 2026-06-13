"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  PlusIcon,
  SignOutIcon,
  SpinnerGapIcon,
  SquaresFourIcon,
  LifebuoyIcon,
} from "@phosphor-icons/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BrandLogo } from "@/components/brand-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { CreateProjectDialog } from "@/components/dashboard/create-project-dialog"
import { ProjectFavicon } from "@/components/dashboard/project-favicon"
import { useAuth, useLogout } from "@/hooks/use-auth"
import { projectOverviewPath, projectSupportPath } from "@/lib/project-routes"
import { selectedProjectForDashboardPath } from "@/lib/project-selection"
import {
  useIsGithubConnected,
  useProjects,
  useSelectProject,
  useSelectedProject,
} from "@/query/project.query"

const CREATE_PROJECT_VALUE = "__create_project__"

function accountInitials(user: {
  name: string | null
  email: string | null
  username: string | null
} | null): string {
  const value = user?.name ?? user?.username ?? user?.email ?? "A"
  return value
    .split(/[^\w]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function DashboardHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const logout = useLogout()
  const github = useIsGithubConnected()
  const projects = useProjects(github.isConnected)
  const selectedQuery = useSelectedProject(github.isConnected)
  const selectProject = useSelectProject()
  const [createOpen, setCreateOpen] = React.useState(false)

  const projectList = projects.data ?? []
  const selected = selectedProjectForDashboardPath(
    projectList,
    selectedQuery.data ?? null,
    pathname
  )

  function onProjectChange(projectId: string) {
    if (projectId === CREATE_PROJECT_VALUE) {
      setCreateOpen(true)
      return
    }

    const project = projectList.find((item) => item.id === projectId)
    if (!project) return

    selectProject.mutate(project.id, {
      onSuccess: (next) => router.push(projectOverviewPath(next)),
    })
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 bg-background px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/dashboard" aria-label="GEO Repair" className="shrink-0">
          <BrandLogo />
        </Link>

        <Select
          value={selected?.id ?? ""}
          disabled={selectProject.isPending}
          onValueChange={onProjectChange}
        >
          <SelectTrigger className="h-9 w-[260px] max-w-[42vw] cursor-pointer bg-secondary text-sm">
            <SelectValue
              placeholder={
                projects.isLoading || selectedQuery.isLoading
                  ? "Loading project"
                  : "No project"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {projectList.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                <span className="flex min-w-0 items-center gap-2">
                  <ProjectFavicon
                    src={project.faviconUrl}
                    className="size-5"
                    imgClassName="size-3.5"
                  />
                  <span className="truncate">{project.name}</span>
                </span>
              </SelectItem>
            ))}
            <SelectItem value={CREATE_PROJECT_VALUE}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center bg-secondary text-muted-foreground">
                  <PlusIcon className="size-3.5" />
                </span>
                <span className="truncate">Create Project</span>
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        {selectProject.isPending ? (
          <SpinnerGapIcon className="size-4 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="grid size-9 cursor-pointer place-items-center bg-secondary text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Avatar size="sm">
                <AvatarImage src={user?.avatarUrl ?? undefined} />
                <AvatarFallback>{accountInitials(user)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-2">
              <p className="truncate text-xs font-medium">
                {user?.name ?? user?.username ?? "Account"}
              </p>
              {user?.email ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              ) : null}
            </div>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => router.push("/dashboard/projects")}
            >
              <SquaresFourIcon className="size-4" />
              Projects
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() =>
                router.push(
                  selected ? projectSupportPath(selected) : "/dashboard/support"
                )
              }
            >
              <LifebuoyIcon className="size-4" />
              Support
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={logout.isPending}
              variant="destructive"
              onSelect={() =>
                logout.mutate(undefined, {
                  onSuccess: () => router.replace("/sign-in"),
                })
              }
            >
              <SignOutIcon className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CreateProjectDialog
        open={createOpen}
        onCreated={(project) => router.push(projectOverviewPath(project))}
        onOpenChange={setCreateOpen}
      />
    </header>
  )
}
