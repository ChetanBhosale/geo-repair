import { CalendarIcon, UserIcon, ShieldCheckIcon } from "@phosphor-icons/react/ssr"

interface EeatBadgeProps {
  updatedDate?: string
  author?: string
  reviewer?: string
}

export function EeatBadge({
  updatedDate = "June 5, 2026",
  author = "GEO Repair Editorial",
  reviewer = "GEO Repair Technical Review",
}: EeatBadgeProps) {
  return (
    <div className="mx-auto mt-4 flex max-w-fit flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border border-border bg-card px-4 py-2 font-mono text-[11px] text-muted-foreground relative">
      <div className="flex items-center gap-1.5">
        <CalendarIcon className="size-3.5 text-muted-foreground/75" aria-hidden />
        <span>Last Updated: {updatedDate}</span>
      </div>
      <span className="hidden text-border sm:inline">|</span>
      <div className="flex items-center gap-1.5">
        <UserIcon className="size-3.5 text-muted-foreground/75" aria-hidden />
        <span>Author: {author}</span>
      </div>
      <span className="hidden text-border sm:inline">|</span>
      <div className="flex items-center gap-1.5">
        <ShieldCheckIcon className="size-3.5 text-muted-foreground/75" aria-hidden />
        <span>Reviewer: {reviewer}</span>
      </div>
    </div>
  )
}
