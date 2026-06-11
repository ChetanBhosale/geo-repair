import { ArrowRightIcon } from "@phosphor-icons/react/ssr"

import { CtaButton } from "@/components/analytics/cta-button"
import { type LandingContent, LANDING_FEATURES } from "@/lib/landing-content"
import { DASHBOARD_ONBOARDING_HREF } from "@/lib/dashboard-url"
import { AsciiOverlay } from "@/components/ascii/ascii-overlay"
import { Reveal } from "@/components/ui/reveal"
import { FreeScanForm } from "@/components/checkup/free-scan-form"
import { CornerMarks } from "./frame"
import { HowItWorks } from "./how-it-works"
import { CategoriesGrid } from "./categories-grid"
import { FeatureSection } from "./feature-section"
import { ScoreGraphic, PrGraphic } from "./feature-graphics"
import { SocialProof } from "./social-proof"
import { TrustSection } from "./trust-section"
import { CtaBand } from "./cta-band"
import { Faq } from "./faq"

export function LandingPage({ content }: { content: LandingContent }) {
  return (
    <>
      {/* Cloudflare-style hero: a big rounded brand-color panel, inset from the
          page edges, with an ASCII line-texture and a glow rising from the
          bottom. The interactive demo sits inside as a white product card. */}
      <section className="px-4 pt-6 pb-12 sm:px-6">
        <Reveal className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-primary px-6 pt-20 pb-16 text-center sm:px-10">
          <AsciiOverlay
            size={15}
            color="rgba(255,255,255,0.3)"
            sensitivity={0.5}
            intensity={0.5}
            centerFade={0.85}
            animation="flow"
            speed={0.0011}
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 z-0 h-2/3 bg-[radial-gradient(60%_75%_at_50%_115%,rgba(255,255,255,0.5),transparent_62%)]"
          />

          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6">
            <p className="font-pixel text-sm tracking-widest text-white uppercase">
              {content.eyebrow}
            </p>
            <h1 className="font-heading text-4xl font-medium tracking-tight text-balance text-white sm:text-5xl">
              {content.headline}{" "}
              <span className="text-white underline decoration-white/45 decoration-2 underline-offset-[6px]">
                {content.headlineAccent}
              </span>
              {content.headlineTail}
            </h1>
            <p className="max-w-xl text-base/relaxed text-pretty text-white/80">
              {content.subhead}
            </p>

            <CtaButton
              href={DASHBOARD_ONBOARDING_HREF}
              location="hero"
              label="Get started"
              size="lg"
              className="bg-white text-primary hover:bg-white/90"
            >
              Get started
              <ArrowRightIcon className="size-4" aria-hidden />
            </CtaButton>

            {/* Free AI search readiness scan. Interactive tool (client) that
                calls the open backend /scan-website endpoint and renders the
                score, category breakdown, and top issues inline. */}
            <div
              id="checkup"
              className="relative w-full max-w-xl scroll-mt-24 border border-black/5 bg-white p-4 text-left sm:p-5"
            >
              <CornerMarks />
              <FreeScanForm inputId={content.inputId} />
            </div>

            <ul className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-white/70">
              {content.trustChips.map((chip, index) => (
                <li key={chip} className="flex items-center gap-2">
                  {index > 0 && (
                    <span aria-hidden className="text-white/40">
                      ·
                    </span>
                  )}
                  <span>{chip}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      <HowItWorks />

      <CategoriesGrid />

      <FeatureSection
        eyebrow={LANDING_FEATURES[0].eyebrow}
        title={LANDING_FEATURES[0].title}
        description={LANDING_FEATURES[0].description}
        points={LANDING_FEATURES[0].points}
        graphic={<ScoreGraphic />}
        image="/images/features/floral-silhouette.jpg"
        imageAlt="Stylized emerald floral silhouette background texture"
      />

      <FeatureSection
        reverse
        eyebrow={LANDING_FEATURES[1].eyebrow}
        title={LANDING_FEATURES[1].title}
        description={LANDING_FEATURES[1].description}
        points={LANDING_FEATURES[1].points}
        graphic={<PrGraphic />}
        image="/images/features/foggy-scene.jpg"
        imageAlt="Stylized smoky foggy forest landscape background texture"
      />

      <SocialProof />

      <TrustSection />

      <CtaBand href="#checkup" ctaLabel={content.ctaLabel} />

      <Faq items={content.faq} />
    </>
  )
}
