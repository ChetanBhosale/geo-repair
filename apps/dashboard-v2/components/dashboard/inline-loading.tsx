import { cn } from "@/lib/utils"

export function DashboardInlineLoading({
  className,
  rows = 3,
}: {
  className?: string
  rows?: number
}) {
  return (
    <div
      aria-busy="true"
      className={cn("animate-pulse space-y-4", className)}
    >
      <div className="h-8 w-52 bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="min-h-32 bg-card">
            <div className="space-y-3 p-4">
              <div className="h-4 w-2/3 bg-muted" />
              <div className="h-3 w-full bg-muted" />
              <div className="h-3 w-1/2 bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
