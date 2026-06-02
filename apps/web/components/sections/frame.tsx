import { cn } from "@/lib/utils"

// Engineering-blueprint corner marks: small "+" crosshairs that straddle the
// four corners of a bordered frame. Decorative only.
function Corner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-20 size-[7px] text-muted-foreground/50",
        className
      )}
    >
      <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-current" />
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current" />
    </span>
  )
}

export function CornerMarks() {
  return (
    <>
      <Corner className="-top-[3.5px] -left-[3.5px]" />
      <Corner className="-top-[3.5px] -right-[3.5px]" />
      <Corner className="-bottom-[3.5px] -left-[3.5px]" />
      <Corner className="-bottom-[3.5px] -right-[3.5px]" />
    </>
  )
}

// Sharp-cornered bordered frame with corner marks. The blocky container that
// wraps gridded content blocks across the site.
export function Frame({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("relative border border-border", className)}>
      <CornerMarks />
      {children}
    </div>
  )
}
