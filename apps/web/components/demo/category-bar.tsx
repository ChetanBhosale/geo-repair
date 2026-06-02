import { cn } from "@/lib/utils"
import type { CategorySubscore } from "@/lib/demo-data"

function barColor(score: number): string {
  if (score >= 80) return "bg-success"
  if (score >= 50) return "bg-warning"
  return "bg-destructive"
}

export function CategoryBar({ subscore }: { subscore: CategorySubscore }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">
          {subscore.category}
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {subscore.score}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden bg-muted"
        role="img"
        aria-label={`${subscore.category}: ${subscore.score} out of 100`}
      >
        <div
          className={cn("h-full", barColor(subscore.score))}
          style={{ width: `${subscore.score}%` }}
        />
      </div>
    </div>
  )
}
