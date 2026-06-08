import { LandingPage } from "@/components/sections/landing"
import { HOME_CONTENT } from "@/lib/landing-content"
import { buildMetadata, definedTermsJsonLd } from "@/lib/seo"
import { JsonLd } from "@/components/seo/json-ld"

export const metadata = buildMetadata({
  title: HOME_CONTENT.metaTitle,
  description: HOME_CONTENT.metaDescription,
  path: HOME_CONTENT.path,
})

const HOME_TERMS = [
  {
    name: "AI Search Optimization",
    definition: "The practice of making a website easy for AI answer engines like ChatGPT, Perplexity, Claude, and Google AI Overviews to read, understand, and cite.",
  }
]

export default function HomePage() {
  return (
    <>
      <JsonLd data={definedTermsJsonLd(HOME_TERMS)} />
      <LandingPage content={HOME_CONTENT} />
    </>
  )
}
