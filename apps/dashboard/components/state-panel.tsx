import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function StatePanel({
  eyebrow,
  title,
  description,
  action,
  tone = "default",
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
  tone?: "default" | "warning" | "danger" | "success"
}) {
  return (
    <section
      className={cn(
        "flex min-h-72 flex-col items-start justify-center gap-3 rounded-lg bg-background p-8",
        tone === "warning" && "bg-amber-500/10",
        tone === "danger" && "bg-destructive/10",
        tone === "success" && "bg-emerald-500/10"
      )}
    >
      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <h2 className="max-w-2xl text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action ? <div className="pt-2">{action}</div> : null}
    </section>
  )
}
