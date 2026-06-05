import Link from "next/link"
import {
  ArrowRightIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react/ssr"

import { CheckupForm } from "@/components/checkup/checkup-form"
import { PageHeader } from "@/components/layout/page-header"
import { JsonLd } from "@/components/seo/json-ld"
import { CornerMarks } from "@/components/sections/frame"
import { Faq } from "@/components/sections/faq"
import { Section } from "@/components/sections/section"
import { Button } from "@/components/ui/button"
import {
  FREE_TOOLS,
  FREE_TOOLS_COMPARISON,
  FREE_TOOLS_FAQ,
  FREE_TOOLS_HEADER,
} from "@/lib/free-tools-content"
import { buildMetadata, breadcrumbJsonLd, SITE } from "@/lib/seo"

export const metadata = buildMetadata({
  title: FREE_TOOLS_HEADER.metaTitle,
  description: FREE_TOOLS_HEADER.metaDescription,
  path: FREE_TOOLS_HEADER.path,
})

function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "GEO Repair free AI search readiness checkup",
    applicationCategory: "SEOApplication",
    operatingSystem: "Web",
    url: new URL(FREE_TOOLS_HEADER.path, SITE.url).toString(),
    description: FREE_TOOLS_HEADER.metaDescription,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: FREE_TOOLS.map((tool) => tool.name),
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
    },
  }
}

function itemListJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Free GEO tools from GEO Repair",
    itemListElement: FREE_TOOLS.map((tool, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: tool.name,
      description: tool.description,
      url: new URL(FREE_TOOLS_HEADER.path, SITE.url).toString(),
    })),
  }
}

export default function FreeGeoToolsPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Free GEO tools", path: FREE_TOOLS_HEADER.path },
          ]),
          softwareApplicationJsonLd(),
          itemListJsonLd(),
        ]}
      />

      <PageHeader
        eyebrow={FREE_TOOLS_HEADER.eyebrow}
        title={FREE_TOOLS_HEADER.title}
        description={FREE_TOOLS_HEADER.description}
      />

      <Section className="border-t-0 pt-12">
        <div className="relative mx-auto grid max-w-5xl border border-border bg-border md:grid-cols-[1.1fr_0.9fr]">
          <CornerMarks />
          <div className="bg-card p-6 sm:p-8">
            <div className="flex max-w-xl flex-col gap-4">
              <div className="flex size-10 items-center justify-center border border-border bg-background">
                <MagnifyingGlassIcon className="size-5 text-foreground" />
              </div>
              <h2 className="font-heading text-2xl font-medium tracking-tight text-foreground">
                Scan your site first
              </h2>
              <p className="text-sm/relaxed text-muted-foreground">
                Paste a URL and get the free report. The scan checks the same
                on-site signals that usually decide whether an AI crawler can
                fetch, parse, and reuse your page.
              </p>
              <Button asChild className="w-fit">
                <Link href="/blog/free-geo-tools-2026">
                  Compare free tools
                  <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
          <div id="checkup" className="scroll-mt-24 bg-background p-4 sm:p-5">
            <div className="relative border border-border bg-card p-4 sm:p-5">
              <CornerMarks />
              <CheckupForm inputId="free-tools-url" />
            </div>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Included diagnostics"
        title="One free scan, six practical checks"
        description="Most teams do not need another dashboard at the start. They need to know what the page looks like to crawlers and which source file or crawl rule is likely causing the issue."
      >
        <ul className="relative mx-auto grid max-w-5xl gap-px border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          <CornerMarks />
          {FREE_TOOLS.map((tool) => (
            <li key={tool.name} className="flex flex-col gap-4 bg-card p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-heading text-base font-medium text-foreground">
                  {tool.name}
                </h3>
                <span className="shrink-0 border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
                  {tool.status}
                </span>
              </div>
              <p className="text-sm/relaxed text-muted-foreground">
                {tool.description}
              </p>
              <ul className="mt-auto flex flex-col gap-2">
                {tool.checks.map((check) => (
                  <li
                    key={check}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <CheckCircleIcon
                      className="size-3.5 shrink-0 text-foreground"
                      aria-hidden
                    />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        eyebrow="How to choose"
        title="Pick the tool by the job"
        description="Free GEO tools are useful when the result is specific. Start broad, then switch to implementation once the report shows a code or crawl blocker."
      >
        <div className="relative mx-auto max-w-4xl border border-border bg-card">
          <CornerMarks />
          {FREE_TOOLS_COMPARISON.map((item) => (
            <div
              key={item.useCase}
              className="grid gap-3 border-b border-border p-6 last:border-b-0 sm:grid-cols-[0.35fr_0.65fr]"
            >
              <h3 className="font-heading text-sm font-medium text-foreground">
                {item.useCase}
              </h3>
              <p className="text-sm/relaxed text-muted-foreground">
                {item.guidance}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Fix path"
        title="When the audit finds a blocker, ship a fix"
        description="A low score is only useful if someone can turn it into a change. GEO Repair is built for that handoff: scan, evidence, sandboxed edit, reviewable pull request, re-check."
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <Button asChild size="lg">
            <Link href="#checkup">
              Run the free scan
              <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
          <Link
            href="/geo-aeo-checker"
            className="font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Or open the dedicated GEO and AEO checker
          </Link>
        </div>
      </Section>

      <Faq
        items={FREE_TOOLS_FAQ}
        title="Free GEO tools FAQ"
        description="Plain answers about what the free scan can measure, what it cannot promise, and when a fix workflow matters."
      />
    </>
  )
}
