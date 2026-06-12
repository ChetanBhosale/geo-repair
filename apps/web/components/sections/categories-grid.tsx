import { CATEGORY_META, CATEGORIES_INTRO } from "@/lib/rubric-meta"
import { AsciiOverlay } from "@/components/ascii/ascii-overlay"
import { CtaButton } from "@/components/analytics/cta-button"
import { CornerMarks } from "./frame"
import { RubricGraphic } from "./rubric-graphics"
import { Section } from "./section"

export function CategoriesGrid() {
  return (
    <Section
      id="checks"
      eyebrow={CATEGORIES_INTRO.eyebrow}
      title={CATEGORIES_INTRO.title}
      description={CATEGORIES_INTRO.description}
    >
      <ul className="relative grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        <CornerMarks />
        {CATEGORY_META.map((category) => (
          <li key={category.category} className="flex flex-col bg-card">
            <RubricGraphic category={category.category} />
            <div className="flex flex-col gap-2 p-6">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-heading text-sm font-medium text-foreground">
                  {category.category}
                </h3>
                <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                  {category.checkCount}{" "}
                  {category.checkCount === 1 ? "check" : "checks"}
                </span>
              </div>
              <p className="text-xs/relaxed text-muted-foreground">
                {category.description}
              </p>
            </div>
          </li>
        ))}

        {/* Bento accent: one emerald tile fills the row and doubles as a CTA.
            Same ASCII line-texture as the hero/CTA bookends, masked to the empty
            right side so it never crowds the left-aligned copy. */}
        <li className="relative isolate flex flex-col items-start justify-center gap-3 overflow-hidden bg-primary p-6 text-left sm:col-span-2 lg:col-span-2">
          <AsciiOverlay
            size={15}
            color="rgba(255,255,255,0.3)"
            sensitivity={0.5}
            intensity={0.48}
            animation="flow"
            speed={0.0011}
            className="[mask-image:linear-gradient(to_right,transparent,transparent_42%,#000_88%)]"
          />
          <div className="relative z-10 flex flex-col items-start gap-3">
            <h3 className="font-heading text-lg font-medium text-white">
              See where your site stands on all 26
            </h3>
            <p className="max-w-md text-sm/relaxed text-white/80">
              Run the free checkup and get the full breakdown, with the exact
              evidence behind every check, in seconds.
            </p>
            <CtaButton
              href="/#checkup"
              location="rubric"
              label="Run free checkup"
              size="sm"
              className="bg-white text-primary hover:bg-white/90"
            >
              Run free checkup
            </CtaButton>
          </div>
        </li>
      </ul>
    </Section>
  )
}
