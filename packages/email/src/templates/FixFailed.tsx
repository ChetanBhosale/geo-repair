import { Section, Text } from "@react-email/components"

import { Button } from "../components/Button"
import { H1, Layout, P } from "../components/Layout"
import { BG, INK, MUTED } from "../theme"

export type FixFailedProps = {
  projectName: string
  error?: string
  dashboardUrl: string
}

/** Sent when a fix run ends in FAILED. */
export default function FixFailed({
  projectName,
  error,
  dashboardUrl,
}: FixFailedProps) {
  return (
    <Layout preview={`The fix run for ${projectName} didn't finish`}>
      <H1>The fix run didn&apos;t finish</H1>
      <P>
        Something went wrong while fixing <strong>{projectName}</strong>, so no
        pull request was opened. Your repository wasn&apos;t changed.
      </P>
      {error ? (
        <Text
          style={{
            background: BG,
            borderRadius: "8px",
            padding: "14px 16px",
            margin: "0 0 16px",
            color: INK,
            fontSize: "13px",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </Text>
      ) : null}
      <P>You can review what happened and retry from your dashboard.</P>
      <Section style={{ marginTop: "8px" }}>
        <Button href={dashboardUrl}>Open the run</Button>
      </Section>
      <Text style={{ margin: "16px 0 0", fontSize: "13px", color: MUTED }}>
        If this keeps happening, reply to this email and we&apos;ll dig in.
      </Text>
    </Layout>
  )
}

FixFailed.PreviewProps = {
  projectName: "acme/marketing-site",
  error: "Build failed: type error in app/page.tsx",
  dashboardUrl: "https://app.geo.repair/runs/run_123",
} satisfies FixFailedProps
