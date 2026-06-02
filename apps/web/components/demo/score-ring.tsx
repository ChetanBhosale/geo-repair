import { cn } from "@/lib/utils"

type ScoreRingProps = {
  score: number
  size?: number
  className?: string
  label?: string
}

function ringColor(score: number): string {
  if (score >= 80) return "var(--success)"
  if (score >= 50) return "var(--warning)"
  return "var(--destructive)"
}

export function ScoreRing({
  score,
  size = 160,
  className,
  label = "AI search readiness",
}: ScoreRingProps) {
  const stroke = Math.max(6, Math.round(size * 0.06))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const dash = (clamped / 100) * circumference
  const color = ringColor(clamped)

  return (
    <div
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${clamped} out of 100`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-heading text-4xl font-medium tracking-tight tabular-nums"
          style={{ color }}
        >
          {clamped}
        </span>
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          / 100
        </span>
      </div>
    </div>
  )
}
