import { LandingPage } from "@/components/sections/landing"
import { HOME_CONTENT } from "@/lib/landing-content"
import { buildMetadata } from "@/lib/seo"

export const metadata = buildMetadata({
  title: HOME_CONTENT.metaTitle,
  description: HOME_CONTENT.metaDescription,
  path: HOME_CONTENT.path,
})

export default function HomePage() {
  return <LandingPage content={HOME_CONTENT} />
}
