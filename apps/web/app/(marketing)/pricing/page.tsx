import Link from "next/link"
import { CheckIcon, ShieldCheckIcon } from "@phosphor-icons/react/ssr"

import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo"
import { TRUST_PROMISES } from "@/lib/trust"
import {
  PRICING_HEADER,
  PRICING_FREE,
  FIX_TIERS_INTRO,
  FIX_TIERS,
  FIX_INCLUDES,
  PRICING_FOOTNOTE,
  PRICING_FAQ_INTRO,
  PRICING_FAQ,
  type PricingTier,
} from "@/lib/marketing-content"
import { cn } from "@/lib/utils"
import { JsonLd } from "@/components/seo/json-ld"
import { PageHeader } from "@/components/layout/page-header"
import { Section } from "@/components/sections/section"
import { Faq } from "@/components/sections/faq"
import { CtaBand } from "@/components/sections/cta-band"
import { CornerMarks } from "@/components/sections/frame"
import { CtaButton } from "@/components/analytics/cta-button"

export const metadata = buildMetadata({
  title:
    "Pricing · Free Checkup, One-Time AI Search Fix from $49 · GEO Repair",
  description:
    "Run a free AI-search readiness checkup, no signup, no card. Fix it with a one-time fee sized to your sitemap, starting at $49.",
  path: "/pricing",
})

// Shared vertical card for the free checkup plan. The one-time fix uses its own
// compact tier cards below.
function PlanCard({
  tier,
  location,
}: {
  tier: PricingTier
  location: string
}) {
  return (
    <div
      className={cn(
        "relative mx-auto flex max-w-md flex-col gap-6 border border-border bg-card p-8",
        tier.featured && "bg-accent/50"
      )}
    >
      <CornerMarks />
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-medium text-foreground">
          {tier.name}
        </h2>
        <p className="flex items-baseline gap-1">
          <span className="font-heading text-3xl font-medium text-foreground">
            {tier.price}
          </span>
          {tier.cadence && (
            <span className="text-sm text-muted-foreground">
              {tier.cadence}
            </span>
          )}
        </p>
        <p className="text-sm/relaxed text-muted-foreground">{tier.blurb}</p>
      </div>

      <ul className="flex flex-1 flex-col gap-3 text-sm text-foreground">
        {tier.features.map((feature) => (
          <li key={feature} className="flex gap-2.5">
            <CheckIcon
              weight="bold"
              className="mt-0.5 size-4 shrink-0 text-success"
              aria-hidden
            />
            <span className="text-pretty">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <CtaButton
          href={tier.href}
          location={location}
          label={tier.cta}
          variant={tier.featured ? "default" : "outline"}
          size="lg"
          className="w-full"
        />
        {tier.note && (
          <p className="text-center text-[11px] text-muted-foreground">
            {tier.note}
          </p>
        )}
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <>
      {/* FAQPage JSON-LD is emitted once by the <Faq> component below. */}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ])}
      />

      <PageHeader
        eyebrow={PRICING_HEADER.eyebrow}
        title={PRICING_HEADER.title}
        description={PRICING_HEADER.description}
      />

      {/* Step 1 — the free checkup. */}
      <Section
        eyebrow="Step 1 · Free"
        title="Start with the free checkup"
        description="See exactly what an AI engine sees before you spend anything."
      >
        <PlanCard tier={PRICING_FREE} location="pricing_free" />
      </Section>

      {/* Step 2 — the one-time fix, priced by sitemap page count. */}
      <Section
        eyebrow={FIX_TIERS_INTRO.eyebrow}
        title={FIX_TIERS_INTRO.title}
        description={FIX_TIERS_INTRO.description}
      >
        <div className="relative grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <CornerMarks />
          {FIX_TIERS.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "flex flex-col gap-4 bg-card p-6",
                tier.featured && "bg-accent/50"
              )}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-sm font-medium text-foreground">
                    {tier.name}
                  </h3>
                  {tier.featured && (
                    <span className="border border-primary/25 bg-primary/5 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-primary uppercase">
                      Most common
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tier.pages}</p>
              </div>

              <p className="font-heading text-3xl font-medium text-foreground">
                {tier.price}
              </p>

              <CtaButton
                href={tier.href}
                location={`pricing_fix_${tier.name.toLowerCase()}`}
                label={tier.cta}
                variant={tier.featured ? "default" : "outline"}
                size="lg"
                className="mt-auto w-full"
              />
            </div>
          ))}
        </div>

        <div className="relative mt-8 border border-border bg-card p-6 sm:p-8">
          <CornerMarks />
          <p className="font-pixel text-sm tracking-widest text-primary uppercase">
            Every fix includes
          </p>
          <ul className="mt-5 grid gap-3 text-sm text-foreground sm:grid-cols-2">
            {FIX_INCLUDES.map((item) => (
              <li key={item} className="flex gap-2.5">
                <CheckIcon
                  weight="bold"
                  className="mt-0.5 size-4 shrink-0 text-success"
                  aria-hidden
                />
                <span className="text-pretty">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <ul className="relative mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2 border border-border bg-card px-5 py-3 text-xs text-muted-foreground">
          <CornerMarks />
          {TRUST_PROMISES.map((promise) => (
            <li key={promise.title} className="flex items-center gap-1.5">
              <ShieldCheckIcon
                className="size-3.5 shrink-0 text-success"
                aria-hidden
              />
              <span>{promise.title}</span>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-6 max-w-2xl text-center text-xs/relaxed text-muted-foreground">
          {PRICING_FOOTNOTE}
        </p>

        <p className="mx-auto mt-3 text-center text-xs text-muted-foreground">
          Running multiple repositories or need something custom?{" "}
          <Link
            href="/contact"
            className="text-primary underline-offset-4 hover:underline"
          >
            Get in touch
          </Link>
          .
        </p>
      </Section>

      <Faq
        items={PRICING_FAQ}
        title={PRICING_FAQ_INTRO.title}
        description={PRICING_FAQ_INTRO.description}
      />

      <CtaBand href="/#checkup" />
    </>
  )
}
