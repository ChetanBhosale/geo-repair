import { Section, Text } from "@react-email/components"

import { Button } from "../components/Button"
import { H1, Layout, P } from "../components/Layout"
import { BG, INK, MUTED } from "../theme"

export type PaymentFailedProps = {
  tier: string
  website: string
  retryUrl: string
  reason?: string
}

/** Sent when a billing order ends in FAILED. */
export default function PaymentFailed({
  tier,
  website,
  retryUrl,
  reason,
}: PaymentFailedProps) {
  return (
    <Layout preview={`Your ${tier} payment didn't go through`}>
      <H1>Your payment didn&apos;t go through</H1>
      <P>
        We couldn&apos;t process your payment for the <strong>{tier}</strong> fix
        on <strong>{website}</strong>, so we didn&apos;t charge you.
      </P>
      {reason ? (
        <Text
          style={{
            background: BG,
            borderRadius: "8px",
            padding: "14px 16px",
            margin: "0 0 16px",
            color: INK,
            fontSize: "13px",
          }}
        >
          {reason}
        </Text>
      ) : null}
      <P>You can try again with the same or a different payment method.</P>
      <Section style={{ marginTop: "8px" }}>
        <Button href={retryUrl}>Try payment again</Button>
      </Section>
      <Text style={{ margin: "16px 0 0", fontSize: "13px", color: MUTED }}>
        Need help? Just reply to this email.
      </Text>
    </Layout>
  )
}

PaymentFailed.PreviewProps = {
  tier: "Growth",
  website: "acme.com",
  retryUrl: "https://geo.repair/checkout?repo=acme",
  reason: "Your card was declined (insufficient funds).",
} satisfies PaymentFailedProps
