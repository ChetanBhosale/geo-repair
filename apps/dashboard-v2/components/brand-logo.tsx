import { cn } from "@/lib/utils"

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid size-6 place-items-center rounded-full border border-primary/30 text-primary">
        <span className="size-2.5 rounded-full bg-primary" />
      </span>
      <span className="text-sm font-medium tracking-tight">GEO Repair</span>
    </span>
  )
}
