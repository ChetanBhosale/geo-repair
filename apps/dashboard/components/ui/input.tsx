import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-lg bg-secondary/50 px-3 py-1 text-sm transition-colors outline-none file:bg-transparent file:text-sm file:font-medium placeholder:text-secondary focus-visible:bg-primary focus-visible:ring-3 focus-visible:ring-focus/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-tertiary/30",
        className
      )}
      {...props}
    />
  )
}

export { Input }
