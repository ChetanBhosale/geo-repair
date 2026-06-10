import { Section } from "@react-email/components"

import { Button } from "../components/Button"
import { H1, Layout, P } from "../components/Layout"
import { SITE } from "../theme"

export type WaitlistWelcomeProps = Record<string, never>

/** Welcome email sent to a new waitlist signup. */
export default function WaitlistWelcome(_props: WaitlistWelcomeProps) {
  return (
    <Layout preview={`You're on the ${SITE.name} waitlist`}>
      <H1>You&apos;re on the list</H1>
      <P>
        Thanks for joining the {SITE.name} waitlist. We&apos;re building a free
        checkup that scores how ready your site is for AI search engines like
        ChatGPT, Perplexity, and Google AI Overviews, then opens a pull request
        to fix what it finds.
      </P>
      <P>
        We&apos;ll email you as soon as your spot is ready. You won&apos;t need
        to write any code.
      </P>
      <Section style={{ marginTop: "8px" }}>
        <Button href={SITE.url}>Visit GEO Repair</Button>
      </Section>
    </Layout>
  )
}

WaitlistWelcome.PreviewProps = {} satisfies WaitlistWelcomeProps
