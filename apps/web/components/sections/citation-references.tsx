import { LinkIcon } from "@phosphor-icons/react/ssr"
import { Section } from "./section"
import { CornerMarks } from "./frame"

export interface ReferenceItem {
  title: string
  sourceName: string
  url: string
  description: string
}

export function CitationReferences({
  title = "Technical Standards & Authority Sourcing",
  description = "Detailed specifications and authoritative documentation that guide our repair agent and readiness checks.",
  references,
}: {
  title?: string
  description?: string
  references: ReferenceItem[]
}) {
  return (
    <Section id="citations" eyebrow="References" title={title} description={description}>
      <div className="relative mx-auto max-w-4xl border border-border bg-card p-6 sm:p-8">
        <CornerMarks />
        <ul className="divide-y divide-border">
          {references.map((ref) => (
            <li key={ref.title} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="flex flex-col gap-1">
                <span className="font-heading text-sm font-medium text-foreground">{ref.title}</span>
                <p className="text-xs text-muted-foreground">{ref.description}</p>
              </div>
              <a
                href={ref.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 flex items-center gap-1.5 text-primary underline underline-offset-4 hover:text-muted-foreground shrink-0"
              >
                <LinkIcon className="size-3.5 mr-1 inline" />
                {ref.sourceName}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
