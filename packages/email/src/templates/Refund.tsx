import { Text } from "@react-email/components"

import { H1, Layout, P } from "../components/Layout"
import { formatMoney } from "../format"
import { MUTED } from "../theme"

export type RefundProps = {
  tier: string
  amountCents: number
  currency: string
  website: string
}

/** Sent when a billing order is REFUNDED. */
export default function Refund({
  tier,
  amountCents,
  currency,
  website,
}: RefundProps) {
  const amount = formatMoney(amountCents, currency)
  return (
    <Layout preview={`Your ${tier} refund of ${amount} is on its way`}>
      <H1>Your refund is on its way</H1>
      <P>
        We&apos;ve refunded <strong>{amount}</strong> for the{" "}
        <strong>{tier}</strong> fix on <strong>{website}</strong>.
      </P>
      <P>
        Depending on your bank, it can take 5 to 10 business days to appear on
        your statement.
      </P>
      <Text style={{ margin: "16px 0 0", fontSize: "13px", color: MUTED }}>
        If you have any questions about this refund, just reply to this email.
      </Text>
    </Layout>
  )
}

Refund.PreviewProps = {
  tier: "Growth",
  amountCents: 14900,
  currency: "USD",
  website: "acme.com",
} satisfies RefundProps
