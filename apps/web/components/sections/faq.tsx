import type { FaqItem } from "@/lib/landing-content"
import { faqJsonLd } from "@/lib/seo"
import { JsonLd } from "@/components/seo/json-ld"
import { CornerMarks } from "./frame"
import { Section } from "./section"
import { FaqDetails } from "./faq-item"

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
  return (
    <Section id={id} eyebrow="FAQ" title={title} description={description}>
      <JsonLd data={faqJsonLd(items)} />
      <div className="relative mx-auto max-w-3xl border border-border bg-card">
        <CornerMarks />
        {items.map((item) => (
          <FaqDetails key={item.question} item={item} />
        ))}
      </div>
    </Section>
  )
}
