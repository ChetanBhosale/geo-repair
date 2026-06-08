import { LandingPage } from "@/components/sections/landing"
import { CHECKER_CONTENT } from "@/lib/landing-content"
import { buildMetadata, definedTermsJsonLd } from "@/lib/seo"
import { JsonLd } from "@/components/seo/json-ld"

export const metadata = buildMetadata({
  title: CHECKER_CONTENT.metaTitle,
  description: CHECKER_CONTENT.metaDescription,
  path: CHECKER_CONTENT.path,
})

const CHECKER_TERMS = [
  {
    name: "Generative Engine Optimization (GEO)",
    definition: "The broad practice of optimizing a site to be used by generative AI engines.",
  },
  {
    name: "Answer Engine Optimization (AEO)",
    definition: "The subset of GEO focused on answerability: question-shaped headings, FAQ markup, and answer-first writing so an engine can lift a direct answer.",
  }
]

export default function GeoAeoCheckerPage() {
  return (
    <>
      <JsonLd data={definedTermsJsonLd(CHECKER_TERMS)} />
      <LandingPage content={CHECKER_CONTENT} />
    </>
  )
}
