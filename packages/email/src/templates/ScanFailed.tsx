import { Section, Text } from "@react-email/components"

import { Button } from "../components/Button"
import { H1, Layout, P } from "../components/Layout"
import { BG, INK, MUTED } from "../theme"

export type ScanFailedProps = {
  websiteUrl: string
  error?: string
  retryUrl: string
}

/** Sent when a scan run ends in FAILED. */
export default function ScanFailed({
  websiteUrl,
  error,
  retryUrl,
}: ScanFailedProps) {
  return (
    <Layout preview={`We couldn't finish the checkup for ${websiteUrl}`}>
      <H1>Your checkup didn&apos;t finish</H1>
      <P>
        We ran into a problem while scanning <strong>{websiteUrl}</strong> and
        couldn&apos;t complete the checkup. This is usually temporary.
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
      <P>Give it another try. Most reruns go through without any issue.</P>
      <Section style={{ marginTop: "8px" }}>
        <Button href={retryUrl}>Run the checkup again</Button>
      </Section>
      <Text style={{ margin: "16px 0 0", fontSize: "13px", color: MUTED }}>
        If it keeps failing, reply to this email and we&apos;ll take a look.
      </Text>
    </Layout>
  )
}

ScanFailed.PreviewProps = {
  websiteUrl: "acme.com",
  error: "Timed out fetching https://acme.com (30s)",
  retryUrl: "https://geo.repair/?url=acme.com",
} satisfies ScanFailedProps
