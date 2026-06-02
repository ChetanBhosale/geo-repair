import type { Metadata } from "next"

import { HalftoneImage } from "@/components/shaders/halftone-image"

// Internal exploration page — keep it out of search and AI crawlers.
export const metadata: Metadata = {
  title: "Shader lab",
  robots: { index: false, follow: false },
}

const IMAGES = [
  { src: "/images/features/abstract.jpg", alt: "Abstract" },
  { src: "/images/features/branches.jpg", alt: "Branches" },
  { src: "/images/features/foggy-scene.jpg", alt: "Foggy scene" },
  { src: "/images/blog/florals.jpg", alt: "Florals" },
]

// Halftone-dots is the finalized effect (live on blog thumbnails and feature
// panels). These tuning variants stay here as a reference for future surfaces.
const VARIANTS: { label: string; overrides?: Record<string, unknown> }[] = [
  { label: "Default (hex / gooey)" },
  { label: "Square grid", overrides: { grid: "square", type: "classic" } },
  { label: "Finer dots", overrides: { size: 0.3, radius: 1 } },
]

export default function ShaderLabPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <header className="mb-12 flex flex-col gap-2">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Internal · shaders.paper.design
        </p>
        <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground">
          Halftone-dots reference
        </h1>
        <p className="max-w-prose text-sm/relaxed text-muted-foreground">
          The finalized effect from Paper&apos;s shader library, brand-matched
          to the emerald theme. Live on blog thumbnails and the feature panels;
          tuning variants below for any future surface.
        </p>
      </header>

      <section className="flex flex-col gap-10">
        {IMAGES.map((img) => (
          <div key={img.src} className="flex flex-col gap-3">
            <p className="font-mono text-xs text-muted-foreground">{img.src}</p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <figure className="flex flex-col gap-2">
                <div className="relative aspect-[4/3] overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <figcaption className="text-center font-mono text-[11px] text-muted-foreground">
                  Original
                </figcaption>
              </figure>
              {VARIANTS.map((v) => (
                <figure key={v.label} className="flex flex-col gap-2">
                  <HalftoneImage
                    src={img.src}
                    alt={img.alt}
                    overrides={v.overrides}
                    className="aspect-[4/3] border border-border"
                  />
                  <figcaption className="text-center font-mono text-[11px] text-muted-foreground">
                    {v.label}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
