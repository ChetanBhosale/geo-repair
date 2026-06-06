import { CornerMarks } from "./frame"
import { Section } from "./section"
import { JsonLd } from "@/components/seo/json-ld"
import { definedTermsJsonLd } from "@/lib/seo"

export interface TermItem {
  name: string
  definition: string
}

export function DefinitionsGlossary({
  title = "Core Concepts & Definitions",
  description = "Key terms explained clearly for human searchers and AI answer engines alike.",
  terms,
}: {
  title?: string
  description?: string
  terms: TermItem[]
}) {
  return (
    <Section id="definitions" eyebrow="Glossary" title={title} description={description}>
      <JsonLd data={definedTermsJsonLd(terms)} />
      <div className="relative mx-auto max-w-4xl border border-border bg-card">
        <CornerMarks />
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {terms.map((term) => (
            <div key={term.name} className="bg-card p-6 flex flex-col gap-2">
              <h3 className="font-heading text-sm font-medium text-foreground">
                <dfn className="not-italic">{term.name}</dfn>
              </h3>
              <p className="text-xs/relaxed text-muted-foreground">{term.definition}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
