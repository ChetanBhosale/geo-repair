import { Section, Text } from "@react-email/components"

import { Button } from "../components/Button"
import { H1, Layout, P } from "../components/Layout"
import { MUTED } from "../theme"

export type FixPrOpenedProps = {
  projectName: string
  prUrl: string
  fixedChecks: number
  dashboardUrl: string
}

/** Sent when the fix run opens a pull request. */
export default function FixPrOpened({
  projectName,
  prUrl,
  fixedChecks,
  dashboardUrl,
}: FixPrOpenedProps) {
  return (
    <Layout preview={`Your pull request for ${projectName} is open`}>
      <H1>Your fix is ready to merge</H1>
      <P>
        The agent finished fixing <strong>{projectName}</strong> and opened a
        pull request that addresses <strong>{fixedChecks}</strong>{" "}
        {fixedChecks === 1 ? "check" : "checks"}. We built and type-checked every
        change in a sandbox first, so it&apos;s ready for you to review.
      </P>
      <Section style={{ marginTop: "8px", marginBottom: "8px" }}>
        <Button href={prUrl}>Review the pull request</Button>
      </Section>
      <Text style={{ margin: "0 0 0", fontSize: "13px", color: MUTED }}>
        Prefer the full breakdown?{" "}
        <a href={dashboardUrl} style={{ color: MUTED }}>
          Open it in your dashboard
        </a>
        .
      </Text>
    </Layout>
  )
}

FixPrOpened.PreviewProps = {
  projectName: "acme/marketing-site",
  prUrl: "https://github.com/acme/marketing-site/pull/42",
  fixedChecks: 6,
  dashboardUrl: "https://app.geo.repair/runs/run_123",
} satisfies FixPrOpenedProps
