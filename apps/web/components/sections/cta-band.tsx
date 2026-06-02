import { ArrowRightIcon } from "@phosphor-icons/react/ssr"

import { AsciiOverlay } from "@/components/ascii/ascii-overlay"
import { CtaButton } from "@/components/analytics/cta-button"
import { Reveal } from "@/components/ui/reveal"

export function CtaBand({
  href = "/#checkup",
  ctaLabel = "Run free checkup",
}: {
  href?: string
  ctaLabel?: string
}) {
  return (
    // Bookend to the hero: the same rounded emerald panel, glow rising from the
    // top edge, ASCII line-texture, and a white pill CTA.
    <section className="px-4 py-12 sm:px-6">
      <Reveal className="relative isolate mx-auto flex max-w-6xl flex-col items-center gap-5 overflow-hidden rounded-[28px] bg-primary px-6 py-24 text-center sm:px-10">
        <AsciiOverlay
          size={15}
          color="rgba(255,255,255,0.3)"
          sensitivity={0.5}
          intensity={0.48}
          centerFade={0.85}
          animation="wave"
          speed={0.001}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 z-0 h-2/3 bg-[radial-gradient(60%_75%_at_50%_-15%,rgba(255,255,255,0.5),transparent_62%)]"
        />

        <div className="relative z-10 flex flex-col items-center gap-5">
          <h2 className="max-w-2xl font-heading text-2xl font-medium tracking-tight text-balance text-white sm:text-3xl">
            Find out what AI search sees when it looks at your site
          </h2>
          <p className="max-w-xl text-sm/relaxed text-pretty text-white/80">
            The checkup is free and takes seconds. No signup, no code, just
            paste your URL and see your score.
          </p>
          <CtaButton
            href={href}
            location="cta_band"
            label={ctaLabel}
            size="lg"
            className="bg-white text-primary hover:bg-white/90"
          >
            {ctaLabel}
            <ArrowRightIcon className="size-4" aria-hidden />
          </CtaButton>
        </div>
      </Reveal>
    </section>
  )
}
