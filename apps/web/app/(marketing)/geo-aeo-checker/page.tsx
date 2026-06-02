import { LandingPage } from "@/components/sections/landing"
import { CHECKER_CONTENT } from "@/lib/landing-content"
import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: CHECKER_CONTENT.metaTitle,
  description: CHECKER_CONTENT.metaDescription,
  path: CHECKER_CONTENT.path,
})

export default function GeoAeoCheckerPage() {
  return <LandingPage content={CHECKER_CONTENT} />
}
