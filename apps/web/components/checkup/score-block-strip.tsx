import { cn } from "@/lib/utils"
import {
  type CheckStatus,
  type SiteCheck,
  statusLabel,
} from "@/lib/scan-result"

type ScoreTone = "success" | "warning" | "destructive" | "muted"

const BAR_STYLES: Record<ScoreTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  muted: "bg-muted",
}

const TEXT_STYLES: Record<ScoreTone, string> = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
}

export type ScoreCategoryRow = {
  category: string
  score: number | null
  status: CheckStatus
  checks: SiteCheck[]
}

function scoreTone(score: number | null): ScoreTone {
  if (score == null) return "muted"
  if (score >= 80) return "success"
  if (score >= 50) return "warning"
  return "destructive"
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function ScoreSummary({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="font-mono text-[11px] text-muted-foreground">n/a</span>
    )
  }

  const rounded = clampScore(score)
  return (
    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
      <span className={TEXT_STYLES[scoreTone(rounded)]}>{rounded}</span>/100
    </span>
  )
}

export function ScoreBlockStrip({
  score,
  blocks = 100,
  className,
  barClassName,
  label,
}: {
  score: number | null
  blocks?: number
  className?: string
  barClassName?: string
  label?: string
}) {
  const safeBlocks = Math.max(1, blocks)
  const rounded = score == null ? null : clampScore(score)
  const filled =
    rounded == null ? 0 : Math.round((rounded / 100) * safeBlocks)
  const tone = scoreTone(rounded)

  return (
    <div
      className={cn("grid w-full gap-px", className)}
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(3px, 1fr))" }}
      role="img"
      aria-label={
        label ?? (rounded == null ? "No score" : `${rounded} out of 100`)
      }
    >
      {Array.from({ length: safeBlocks }, (_, index) => (
        <span
          key={index}
          className={cn(
            "h-8 min-w-0",
            index < filled ? BAR_STYLES[tone] : "bg-muted",
            barClassName
          )}
        />
      ))}
    </div>
  )
}

export function CategoryScoreRows({ rows }: { rows: ScoreCategoryRow[] }) {
  if (rows.length === 0) return null

  return (
    <div className="grid gap-px bg-border">
      {rows.map((row) => {
        const tone = scoreTone(row.score)
        return (
          <section key={row.category} className="bg-card px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">
                {row.category}
              </h3>
              <span
                className={cn(
                  "font-mono text-xs tabular-nums",
                  TEXT_STYLES[tone]
                )}
              >
                {row.score == null ? "n/a" : `${row.score} / 100`}
              </span>
            </div>
            <ScoreBlockStrip
              score={row.score}
              className="mt-3"
              barClassName="h-8"
              label={`${row.category}: ${
                row.score == null ? "not applicable" : `${row.score} out of 100`
              }.`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <ScoreSummary score={row.score} />
              <span>{statusLabel(row.status)}</span>
            </div>
          </section>
        )
      })}
    </div>
  )
}
