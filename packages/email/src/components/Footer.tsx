import { Link, Text } from "@react-email/components"

import { MUTED, SITE } from "../theme"

/** "GEO Repair · AI Search Optimization · geo.repair" footer line. */
export function Footer() {
  return (
    <Text
      style={{
        maxWidth: "520px",
        margin: "16px auto 0",
        color: MUTED,
        fontSize: "12px",
        lineHeight: 1.5,
        textAlign: "center",
      }}
    >
      {SITE.name} · {SITE.tagline} ·{" "}
      <Link href={SITE.url} style={{ color: MUTED }}>
        geo.repair
      </Link>
    </Text>
  )
}
