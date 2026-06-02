import { cn } from "@/lib/utils"
import { Reveal } from "@/components/ui/reveal"

type SectionProps = {
  id?: string
  eyebrow?: string
  title?: React.ReactNode
  description?: React.ReactNode
  headingLevel?: "h1" | "h2"
  align?: "center" | "start"
  className?: string
  containerClassName?: string
  children?: React.ReactNode
}

export function Section({
  id,
  eyebrow,
  title,
  description,
  headingLevel = "h2",
  align = "center",
  className,
  containerClassName,
  children,
}: SectionProps) {
  const Heading = headingLevel
  const hasHeader = Boolean(eyebrow || title || description)

  return (
    <section id={id} className={cn("border-t border-border py-20", className)}>
      <div className={cn("mx-auto max-w-6xl px-4 sm:px-6", containerClassName)}>
        {hasHeader && (
          <Reveal
            className={cn(
              "flex max-w-2xl flex-col gap-3",
              align === "center" && "mx-auto text-center"
            )}
          >
            {eyebrow && (
              <p className="font-pixel text-sm tracking-widest text-primary uppercase">
                {eyebrow}
              </p>
            )}
            {title && (
              <Heading className="font-heading text-2xl font-medium tracking-tight text-balance text-foreground sm:text-3xl">
                {title}
              </Heading>
            )}
            {description && (
              <p className="text-sm/relaxed text-pretty text-muted-foreground">
                {description}
              </p>
            )}
          </Reveal>
        )}
        {children && (
          <Reveal delay={120} className={cn(hasHeader && "mt-12")}>
            {children}
          </Reveal>
        )}
      </div>
    </section>
  )
}
