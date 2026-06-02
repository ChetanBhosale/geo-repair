import { cn } from "@/lib/utils"

// Long-form prose container for legal pages and blog posts: editorial sizing and
// spacing applied via descendant selectors so authored content (and MDX) stays
// clean. Inline code keeps the mono face.
export function Prose({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "font-sans text-sm/relaxed text-muted-foreground",
        "[&>*:first-child]:mt-0",
        "[&_h2]:mt-10 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:text-foreground",
        "[&_h3]:mt-6 [&_h3]:font-heading [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-foreground",
        "[&_p]:mt-4",
        "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
        "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5",
        "[&_li]:pl-1",
        "[&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4",
        "[&_strong]:font-medium [&_strong]:text-foreground",
        "[&_code]:font-mono [&_code]:text-xs [&_code]:text-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}
