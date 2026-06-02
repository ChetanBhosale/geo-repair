import type { Metadata } from "next"
import {
  GeistPixelSquare,
  GeistPixelGrid,
  GeistPixelCircle,
  GeistPixelTriangle,
  GeistPixelLine,
} from "geist/font/pixel"

import { cn } from "@/lib/utils"

// Internal exploration page — keep it out of search and AI crawlers.
export const metadata: Metadata = {
  title: "Pixel eyebrow lab",
  robots: { index: false, follow: false },
}

const VARIANTS = [
  { label: "Square", className: GeistPixelSquare.className },
  { label: "Grid", className: GeistPixelGrid.className },
  { label: "Circle", className: GeistPixelCircle.className },
  { label: "Triangle", className: GeistPixelTriangle.className },
  { label: "Line", className: GeistPixelLine.className },
]

const EYEBROW = "AI Search Optimization"

// Each row shows one variant rendered in the treatments we're choosing between,
// on both the light page surface and the emerald hero panel.
function LightRow({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-6">
      <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
        {/* current */}
        <p className={cn(className, "text-xs tracking-widest text-muted-foreground uppercase")}>
          {EYEBROW}
        </p>
        {/* bigger + emerald accent */}
        <p className={cn(className, "text-sm tracking-widest text-primary uppercase")}>
          {EYEBROW}
        </p>
        {/* bigger still */}
        <p className={cn(className, "text-base tracking-[0.18em] text-foreground uppercase")}>
          {EYEBROW}
        </p>
        {/* badge */}
        <span className={cn(className, "inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs tracking-widest text-primary uppercase")}>
          {EYEBROW}
        </span>
      </div>
    </div>
  )
}

function EmeraldRow({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/15 py-6">
      <span className="font-mono text-[11px] tracking-wide text-white/60">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
        {/* current */}
        <p className={cn(className, "text-xs tracking-widest text-white/70 uppercase")}>
          {EYEBROW}
        </p>
        {/* brighter + bigger */}
        <p className={cn(className, "text-sm tracking-widest text-white uppercase")}>
          {EYEBROW}
        </p>
        {/* bigger still */}
        <p className={cn(className, "text-base tracking-[0.18em] text-white uppercase")}>
          {EYEBROW}
        </p>
        {/* badge */}
        <span className={cn(className, "inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs tracking-widest text-white uppercase")}>
          {EYEBROW}
        </span>
      </div>
    </div>
  )
}

export default function PixelLabPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="mb-10 flex flex-col gap-2">
        <p className={cn(GeistPixelSquare.className, "text-xs tracking-widest text-muted-foreground uppercase")}>
          Internal · pixel eyebrows
        </p>
        <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground">
          Geist Pixel eyebrow variants
        </h1>
        <p className="max-w-prose text-sm/relaxed text-muted-foreground">
          5 variants × 4 treatments. Columns left→right: current (xs, muted),
          sm + emerald accent, base + tighter, and a tinted badge. Geist Pixel
          ships one weight (500), so &ldquo;bolder&rdquo; comes from size,
          variant choice, and color — not a heavier cut.
        </p>
      </header>

      {/* Large samples first: the pixel-shape difference between variants only
          reads at display size. Pick a variant here, then judge it at eyebrow
          size in the treatment rows below. */}
      <section className="mb-16 flex flex-col gap-5">
        <h2 className="font-heading text-lg font-medium text-foreground">
          Variant shapes (display size)
        </h2>
        {VARIANTS.map((v) => (
          <div
            key={v.label}
            className="flex flex-col gap-1 border-b border-border pb-4"
          >
            <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
              {v.label}
            </span>
            <p
              className={cn(
                v.className,
                "text-3xl tracking-wider text-foreground uppercase sm:text-4xl"
              )}
            >
              AI Search
            </p>
          </div>
        ))}
      </section>

      <section className="mb-16">
        <h2 className="mb-2 font-heading text-lg font-medium text-foreground">
          On the light page surface
        </h2>
        <div>
          {VARIANTS.map((v) => (
            <LightRow key={v.label} label={v.label} className={v.className} />
          ))}
        </div>
      </section>

      <section className="rounded-[28px] bg-primary px-6 py-10 sm:px-10">
        <h2 className="mb-2 font-heading text-lg font-medium text-white">
          On the emerald hero panel
        </h2>
        <div>
          {VARIANTS.map((v) => (
            <EmeraldRow key={v.label} label={v.label} className={v.className} />
          ))}
        </div>
      </section>
    </main>
  )
}
