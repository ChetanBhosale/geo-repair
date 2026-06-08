import type { FaqItem } from "@/lib/landing-content"
import { faqJsonLd, definedTermsJsonLd } from "@/lib/seo"
import { JsonLd } from "@/components/seo/json-ld"
import { CornerMarks } from "./frame"
import { Section } from "./section"
import { FaqDetails } from "./faq-item"

function extractDefinedTerms(items: FaqItem[]) {
  const terms: { name: string; definition: string }[] = []
  for (const item of items) {
    const q = item.question.trim()
    if (/^what\s+is\s+/i.test(q)) {
      let name = q.replace(/^what\s+is\s+(?:a\s+|an\s+)?/i, "")
      if (name.endsWith("?")) {
        name = name.slice(0, -1)
      }
      name = name.trim()
      if (name) {
        name = name.charAt(0).toUpperCase() + name.slice(1)
        terms.push({ name, definition: item.answer })
      }
    }
  }
  return terms
}

export function Faq({
  items,
  id = "faq",
  title = "Frequently asked questions",
  description,
}: {
  items: FaqItem[]
  id?: string
  title?: string
  description?: string
}) {
  const definedTerms = extractDefinedTerms(items)

  return (
    <Section id={id} eyebrow="FAQ" title={title} description={description}>
      <JsonLd data={faqJsonLd(items)} />
      {definedTerms.length > 0 && (
        <JsonLd data={definedTermsJsonLd(definedTerms)} />
      )}
      <div className="relative mx-auto max-w-3xl border border-border bg-card">
        <CornerMarks />
        {items.map((item) => (
          <FaqDetails key={item.question} item={item} />
        ))}
      </div>
    </Section>
  )
}
