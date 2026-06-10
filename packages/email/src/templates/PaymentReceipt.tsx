import { Hr, Row, Column, Section, Text } from "@react-email/components"

import { Button } from "../components/Button"
import { H1, Layout, P } from "../components/Layout"
import { formatMoney } from "../format"
import { BG, INK, MUTED } from "../theme"

export type PaymentReceiptProps = {
  tier: string
  amountCents: number
  currency: string
  website: string
  invoiceUrl?: string
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ marginBottom: "6px" }}>
      <Column style={{ color: MUTED, fontSize: "14px" }}>{label}</Column>
      <Column
        style={{
          color: INK,
          fontSize: "14px",
          fontWeight: 600,
          textAlign: "right",
        }}
      >
        {value}
      </Column>
    </Row>
  )
}

/** Receipt sent when a billing order is marked PAID. */
export default function PaymentReceipt({
  tier,
  amountCents,
  currency,
  website,
  invoiceUrl,
}: PaymentReceiptProps) {
  const amount = formatMoney(amountCents, currency)
  return (
    <Layout preview={`Your ${tier} payment is confirmed`}>
      <H1>Payment confirmed</H1>
      <P>
        Thanks for your purchase. Your <strong>{tier}</strong> fix is unlocked
        for <strong>{website}</strong>. You can start the fix run from your
        dashboard whenever you&apos;re ready.
      </P>
      <Section
        style={{ background: BG, borderRadius: "12px", padding: "18px 20px", margin: "0 0 20px" }}
      >
        <DetailRow label="Plan" value={tier} />
        <DetailRow label="Website" value={website} />
        <Hr style={{ borderColor: "#e5e7eb", margin: "10px 0" }} />
        <DetailRow label="Total paid" value={amount} />
      </Section>
      {invoiceUrl ? (
        <Section style={{ marginTop: "8px" }}>
          <Button href={invoiceUrl}>View invoice</Button>
        </Section>
      ) : null}
      <Text style={{ margin: "16px 0 0", fontSize: "13px", color: MUTED }}>
        You paid once for this fix. We won&apos;t bill you again.
      </Text>
    </Layout>
  )
}

PaymentReceipt.PreviewProps = {
  tier: "Growth",
  amountCents: 14900,
  currency: "USD",
  website: "acme.com",
  invoiceUrl: "https://geo.repair/invoice/inv_123",
} satisfies PaymentReceiptProps
