import {
  LinkIcon,
  QuotesIcon,
  TextAlignLeftIcon,
} from "@phosphor-icons/react/ssr"

import { Frame } from "./frame"
import { Section } from "./section"

const FINDINGS = [
  {
    Icon: TextAlignLeftIcon,
    stat: "Answer-first",
    body: "Across citation studies, the strongest predictor of whether an AI engine quotes a page was direct answerability: saying what something is in the first sentence. We score and surface it.",
  },
  {
    Icon: LinkIcon,
    stat: "Cite your sources",
    body: "Linking to trusted external sources (research, primary data, standards bodies) ranked among the top predictors of being quoted. We flag claims that name a source but link nothing.",
  },
  {
    Icon: QuotesIcon,
    stat: "Educational wins",
    body: "Informational and how-to pages get quoted several times more than transactional ones. We're honest about that ceiling instead of promising citations a pricing page can't earn.",
  },
]

export function SocialProof() {
  return (
    <Section
      eyebrow="What the research shows"
      title="The signals AI engines actually reward"
      description="AI Search Optimization isn't guesswork. Independent citation research points to a consistent set of on-site signals, the same ones our rubric measures."
    >
      <Frame>
        <div className="grid gap-px bg-border md:grid-cols-3">
          {FINDINGS.map((finding) => {
            const Icon = finding.Icon
            return (
              <div
                key={finding.stat}
                className="flex flex-col gap-3 bg-card p-6"
              >
              <Icon className="size-5 text-foreground" aria-hidden />
              <p className="font-heading text-lg font-medium text-foreground">
                {finding.stat}
              </p>
              <p className="text-sm/relaxed text-muted-foreground">
                {finding.body}
              </p>
              </div>
            )
          })}
        </div>
      </Frame>
    </Section>
  )
}
