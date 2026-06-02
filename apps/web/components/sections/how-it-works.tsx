import {
  HOW_IT_WORKS_INTRO,
  HOW_IT_WORKS_STEPS,
} from "@/lib/landing-content"
import { ScanGraphic, ReportGraphic, PrGraphic } from "./how-it-works-graphics"
import { Frame } from "./frame"
import { Section } from "./section"

// Graphics stay colocated with the component; copy lives in lib/landing-content
// so the page and its Markdown twin render from one source. Index-aligned.
const STEP_GRAPHICS = [ScanGraphic, ReportGraphic, PrGraphic]

export function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      eyebrow={HOW_IT_WORKS_INTRO.eyebrow}
      title={HOW_IT_WORKS_INTRO.title}
      description={HOW_IT_WORKS_INTRO.description}
    >
      <Frame>
        <ol className="grid gap-px bg-border md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step, index) => {
            const Graphic = STEP_GRAPHICS[index]
            return (
              <li key={step.title} className="flex flex-col bg-card">
                <Graphic />
                <div className="flex flex-col gap-2 p-6">
                <span className="font-mono text-xs text-muted-foreground">
                  {step.n}
                </span>
                <h3 className="font-heading text-base font-medium text-foreground">
                  {step.title}
                </h3>
                  <p className="text-sm/relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </Frame>
    </Section>
  )
}
