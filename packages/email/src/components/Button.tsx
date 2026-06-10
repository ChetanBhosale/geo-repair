import { Button as REButton } from "@react-email/components"

import { ACCENT } from "../theme"

/** Primary CTA button. Ports the inline-styled anchor from the old email.ts. */
export function Button({ href, children }: { href: string; children: string }) {
  return (
    <REButton
      href={href}
      style={{
        display: "inline-block",
        background: ACCENT,
        color: "#ffffff",
        textDecoration: "none",
        fontWeight: 600,
        fontSize: "14px",
        padding: "11px 20px",
        borderRadius: "8px",
      }}
    >
      {children}
    </REButton>
  )
}
