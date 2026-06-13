import { Section, Text } from "@react-email/components"

import { Button } from "../components/Button"
import { H1, Layout, P } from "../components/Layout"
import { MUTED } from "../theme"

export type AiCreditsExhaustedProps = {
  projectName: string
  prUrl?: string
}

/** Sent when follow-up AI credits for a paid fix workspace run out. */
export default function AiCreditsExhausted({
  projectName,
  prUrl,
}: AiCreditsExhaustedProps) {
  return (
    <Layout preview={`You've used the follow-up AI credits for ${projectName}`}>
      <H1>Your follow-up AI credits are used</H1>
      <P>
        You&apos;ve used the included follow-up AI credits for{" "}
        <strong>{projectName}</strong>. The pull request stays open, and you can
        still review or merge it.
      </P>
      <P>
        Need more changes? Reply to this email and we&apos;ll help add credits
        or route the next round.
      </P>
      {prUrl ? (
        <Section style={{ marginTop: "8px" }}>
          <Button href={prUrl}>View the pull request</Button>
        </Section>
      ) : null}
      <Text style={{ margin: "16px 0 0", fontSize: "13px", color: MUTED }}>
        Questions about your run? Just reply to this email.
      </Text>
    </Layout>
  )
}

AiCreditsExhausted.PreviewProps = {
  projectName: "acme/marketing-site",
  prUrl: "https://github.com/acme/marketing-site/pull/42",
} satisfies AiCreditsExhaustedProps
