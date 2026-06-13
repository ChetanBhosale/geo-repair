import type { Project } from "@repo/types/project"

export function slugFromDashboardPath(pathname: string): string | null {
  const [, dashboard, slug] = pathname.split("/")
  if (dashboard !== "dashboard") return null
  if (!slug || slug === "projects") return null
  return decodeURIComponent(slug)
}

export function selectedProjectForDashboardPath(
  projects: Project[],
  selectedProject: Project | null,
  pathname: string
): Project | null {
  const pathSlug = slugFromDashboardPath(pathname)
  if (pathSlug) {
    const routeProject = projects.find((project) => project.slug === pathSlug)
    if (routeProject) return routeProject
  }

  return (
    projects.find((project) => project.selected) ??
    selectedProject ??
    projects[0] ??
    null
  )
}
