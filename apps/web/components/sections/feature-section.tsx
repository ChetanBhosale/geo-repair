import { CheckIcon } from "@phosphor-icons/react/ssr"

import { cn } from "@/lib/utils"
import { HalftoneImage } from "@/components/shaders/halftone-image"
import { Reveal } from "@/components/ui/reveal"

type FeatureSectionProps = {
  id?: string
  eyebrow: string
  title: React.ReactNode
  description: React.ReactNode
  points?: string[]
  graphic: React.ReactNode
  /** Background photo for the graphic panel, rendered as a halftone-dot
   * texture. Falls back to a gradient when omitted. */
  image?: string
  /** Optional original source for the live shader when `image` is a baked fallback. */
  shaderImage?: string
  imageAlt?: string
  reverse?: boolean
}

export function FeatureSection({
  id,
  eyebrow,
  title,
  description,
  points,
  graphic,
  image,
  shaderImage,
  imageAlt = "",
  reverse = false,
}: FeatureSectionProps) {
  return (
    <section id={id} className="border-t border-border">
      <div className="mx-auto grid max-w-6xl items-stretch gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <Reveal
          className={cn(
            "flex flex-col justify-center gap-4 py-16 sm:py-20",
            reverse && "lg:order-2"
          )}
        >
          <p className="font-pixel text-sm tracking-widest text-primary uppercase">
            {eyebrow}
          </p>
          <h2 className="font-heading text-2xl font-medium tracking-tight text-balance text-foreground sm:text-3xl">
            {title}
          </h2>
          <p className="text-sm/relaxed text-pretty text-muted-foreground">
            {description}
          </p>
          {points && points.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm">
                  <CheckIcon
                    className="mt-0.5 size-4 shrink-0 text-success"
                    aria-hidden
                  />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          )}
        </Reveal>

        <Reveal
          delay={120}
          className={cn(
            "relative isolate flex min-h-72 items-center justify-center overflow-hidden border border-border p-6 sm:p-10",
            reverse && "lg:order-1"
          )}
        >
          {image ? (
            <HalftoneImage
              src={image}
              shaderSrc={shaderImage}
              alt={imageAlt}
              className="absolute inset-0 -z-20"
            />
          ) : (
            <div
              aria-hidden
              className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_30%_20%,oklch(0.45_0.12_265),transparent_55%),radial-gradient(circle_at_75%_80%,oklch(0.5_0.13_25),transparent_50%),linear-gradient(135deg,oklch(0.22_0.04_265),oklch(0.18_0.03_300))]"
            />
          )}

          <div className="relative z-10 w-full max-w-sm border border-border bg-white p-4">
            {graphic}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
