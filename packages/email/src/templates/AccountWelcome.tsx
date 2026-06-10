import { Section } from "@react-email/components"

import { Button } from "../components/Button"
import { H1, Layout, P } from "../components/Layout"
import { SITE } from "../theme"

export type AccountWelcomeProps = {
  name?: string
  dashboardUrl: string
}

/** Sent the first time a user creates an account (via GitHub/Google OAuth). */
export default function AccountWelcome({
  name,
  dashboardUrl,
}: AccountWelcomeProps) {
  return (
    <Layout preview={`Welcome to ${SITE.name}`}>
      <H1>Welcome to {SITE.name}</H1>
      <P>{name ? `Hi ${name},` : "Hi there,"}</P>
      <P>
        Your account is ready. Connect a repository and run a scan.{" "}
        {SITE.name} finds what&apos;s holding your site back in AI search, then
        opens a pull request that fixes it.
      </P>
      <Section style={{ marginTop: "8px" }}>
        <Button href={dashboardUrl}>Open your dashboard</Button>
      </Section>
    </Layout>
  )
}

AccountWelcome.PreviewProps = {
  name: "Jordan",
  dashboardUrl: "https://app.geo.repair",
} satisfies AccountWelcomeProps
