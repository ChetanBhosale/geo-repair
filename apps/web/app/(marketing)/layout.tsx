import { Footer } from "@/components/layout/footer"
import { TopNav } from "@/components/layout/top-nav"
import { JsonLd } from "@/components/seo/json-ld"
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      <TopNav />
      <main id="main">{children}</main>
      <Footer />
    </>
  )
}
