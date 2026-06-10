import { Section, Text } from "@react-email/components"

import { Button } from "../components/Button"
import { H1, Layout, P } from "../components/Layout"
import { MUTED } from "../theme"

export type FixPlanReadyProps = {
  projectName: string
  checkCount: number
  reviewUrl: string
}

/** Sent when the agent has drafted a plan and needs the user's answers. */
export default function FixPlanReady({
  projectName,
  checkCount,
  reviewUrl,
}: FixPlanReadyProps) {
  return (
    <Layout preview={`Your fix plan for ${projectName} is ready to review`}>
      <H1>Your fix plan is ready</H1>
      <P>
        The agent finished analyzing <strong>{projectName}</strong> and drafted a
        plan covering <strong>{checkCount}</strong>{" "}
        {checkCount === 1 ? "check" : "checks"}.
      </P>
      <P>
        A few items need your call before it starts. Approve or skip each one,
        then submit to start the fix.
      </P>
      <Section style={{ marginTop: "8px" }}>
        <Button href={reviewUrl}>Review the plan</Button>
      </Section>
      <Text style={{ margin: "16px 0 0", fontSize: "13px", color: MUTED }}>
        Nothing runs until you submit your answers.
      </Text>
    </Layout>
  )
}

FixPlanReady.PreviewProps = {
  projectName: "acme/marketing-site",
  checkCount: 7,
  reviewUrl: "https://app.geo.repair/runs/run_123",
} satisfies FixPlanReadyProps
