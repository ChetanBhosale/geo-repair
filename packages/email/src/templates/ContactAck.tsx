import { Section } from "@react-email/components"

import { Button } from "../components/Button"
import { H1, Layout, P } from "../components/Layout"
import { SITE } from "../theme"

export type ContactAckProps = {
  name?: string
}

/** Acknowledgement sent back to whoever submitted the contact form. */
export default function ContactAck({ name }: ContactAckProps) {
  return (
    <Layout preview={`Thanks for contacting ${SITE.name}`}>
      <H1>Thanks for reaching out</H1>
      <P>{name ? `Hi ${name},` : "Hi there,"}</P>
      <P>
        We got your message and someone from the {SITE.name} team will get back
        to you shortly. In the meantime, feel free to explore the site.
      </P>
      <Section style={{ marginTop: "8px" }}>
        <Button href={SITE.url}>Visit GEO Repair</Button>
      </Section>
    </Layout>
  )
}

ContactAck.PreviewProps = {
  name: "Jordan",
} satisfies ContactAckProps
