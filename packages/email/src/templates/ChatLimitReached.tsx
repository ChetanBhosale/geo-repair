import { Section, Text } from "@react-email/components"

import { Button } from "../components/Button"
import { H1, Layout, P } from "../components/Layout"
import { MUTED } from "../theme"

export type ChatLimitReachedProps = {
  projectName: string
  prUrl?: string
}

/** Sent when the post-PR chat for a run runs out of messages. */
export default function ChatLimitReached({
  projectName,
  prUrl,
}: ChatLimitReachedProps) {
  return (
    <Layout preview={`You've reached the chat limit for ${projectName}`}>
      <H1>You&apos;ve reached the chat limit</H1>
      <P>
        You&apos;ve used all the follow-up messages for the fix run on{" "}
        <strong>{projectName}</strong>. The pull request stays open, so you can
        still review and merge it.
      </P>
      <P>
        Need more changes? Start a fresh run to plan and apply the next round of
        fixes.
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

ChatLimitReached.PreviewProps = {
  projectName: "acme/marketing-site",
  prUrl: "https://github.com/acme/marketing-site/pull/42",
} satisfies ChatLimitReachedProps
