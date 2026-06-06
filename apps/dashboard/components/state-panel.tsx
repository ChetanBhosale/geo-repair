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
        "flex min-h-72 flex-col items-start justify-center gap-3 rounded-lg bg-primary p-8",
        tone === "warning" && "bg-warning/10",
        tone === "danger" && "bg-danger/10",
        tone === "success" && "bg-success/10"
      )}
    >
      <p className="font-mono text-xs tracking-wide text-secondary uppercase">
        {eyebrow}
      </p>
      <h2 className="max-w-2xl text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="max-w-3xl text-sm leading-6 text-secondary">
        {description}
      </p>
      {action ? <div className="pt-2">{action}</div> : null}
    </section>
  )
}
