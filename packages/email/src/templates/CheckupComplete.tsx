import { Section, Text } from "@react-email/components"

import { Button } from "../components/Button"
import { H1, Layout, P } from "../components/Layout"
import { MUTED } from "../theme"

export type CheckupCompleteProps = {
  websiteUrl: string
  score: number
  scoreStatus: "SUCCESS" | "MID" | "FAILED"
  reportUrl: string
}

const SCORE_COLOR: Record<CheckupCompleteProps["scoreStatus"], string> = {
  SUCCESS: "#047857", // emerald
  MID: "#b45309", // amber
  FAILED: "#b91c1c", // red
}

const SCORE_LABEL: Record<CheckupCompleteProps["scoreStatus"], string> = {
  SUCCESS: "Looking good",
  MID: "Room to improve",
  FAILED: "Needs work",
}

/** Sent when a free/paid checkup finishes and the score is ready. */
export default function CheckupComplete({
  websiteUrl,
  score,
  scoreStatus,
  reportUrl,
}: CheckupCompleteProps) {
  const color = SCORE_COLOR[scoreStatus]
  return (
    <Layout preview={`Your AI search checkup for ${websiteUrl} is ready`}>
      <H1>Your checkup is ready</H1>
      <P>
        We finished scanning <strong>{websiteUrl}</strong> for AI search
        readiness. Here&apos;s where it stands:
      </P>
      <Section
        style={{
          background: "#f6f7f6",
          borderRadius: "12px",
          padding: "20px 24px",
          margin: "0 0 20px",
          textAlign: "center",
        }}
      >
        <Text
          style={{
            margin: 0,
            fontSize: "40px",
            fontWeight: 700,
            color,
            lineHeight: 1.1,
          }}
        >
          {score}
          <span style={{ fontSize: "20px", color: MUTED }}>/100</span>
        </Text>
        <Text
          style={{ margin: "4px 0 0", fontSize: "13px", color, fontWeight: 600 }}
        >
          {SCORE_LABEL[scoreStatus]}
        </Text>
      </Section>
      <P>
        Open the full report to see every check, the evidence behind it, and what
        to fix first.
      </P>
      <Section style={{ marginTop: "8px" }}>
        <Button href={reportUrl}>View the full report</Button>
      </Section>
      <Text style={{ margin: "16px 0 0", fontSize: "13px", color: MUTED }}>
        Want the fixes done for you? GEO Repair can open a pull request that
        raises your score automatically.
      </Text>
    </Layout>
  )
}

CheckupComplete.PreviewProps = {
  websiteUrl: "acme.com",
  score: 62,
  scoreStatus: "MID",
  reportUrl: "https://geo.repair/report/abc123",
} satisfies CheckupCompleteProps
