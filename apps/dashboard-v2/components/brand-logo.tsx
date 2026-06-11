import { cn } from "@/lib/utils"
import { LogoMark } from "@/components/logo-mark"

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-6 text-primary" />
      <span className="text-sm font-medium tracking-tight">GEO Repair</span>
    </span>
  )
}
