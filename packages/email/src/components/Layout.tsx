import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { ReactNode } from "react"

import {
  ACCENT,
  BG,
  BORDER,
  CARD,
  FONT_FAMILY,
  INK,
  LOGO_URL,
  SITE,
} from "../theme"
import { Footer } from "./Footer"

// The shared card shell every template renders into. Ports layout() from the
// old apps/web/lib/email.ts: white 520px card on a gray page, brand wordmark
// header, body, and a centered footer line.
export function Layout({
  preview,
  children,
}: {
  /** Inbox preview text (the gray snippet shown next to the subject). */
  preview: string
  children: ReactNode
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          background: BG,
          fontFamily: FONT_FAMILY,
        }}
      >
        <Section style={{ background: BG, padding: "32px 16px" }}>
          <Container
            style={{
              maxWidth: "520px",
              background: CARD,
              borderRadius: "12px",
              border: `1px solid ${BORDER}`,
              overflow: "hidden",
            }}
          >
            <Section style={{ padding: "28px 32px 8px" }}>
              {/* Tight inline lockup: a fixed-width table sized to the logo so
                  the wordmark sits right next to the mark instead of being
                  pushed across a full-width column. */}
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                border={0}
              >
                <tbody>
                  <tr>
                    <td style={{ verticalAlign: "middle" }}>
                      <Img
                        src={LOGO_URL}
                        width="22"
                        height="22"
                        alt={SITE.name}
                        style={{ display: "block" }}
                      />
                    </td>
                    <td style={{ verticalAlign: "middle", paddingLeft: "7px" }}>
                      <Text
                        style={{
                          margin: 0,
                          fontSize: "15px",
                          fontWeight: 700,
                          color: ACCENT,
                          letterSpacing: "-0.01em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {SITE.name}
                      </Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
            <Section
              style={{
                padding: "8px 32px 32px",
                color: INK,
                fontSize: "15px",
                lineHeight: 1.6,
              }}
            >
              {children}
            </Section>
          </Container>
          <Footer />
        </Section>
      </Body>
    </Html>
  )
}

// Small shared text helpers so templates stay terse and on-brand.
export function H1({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: "0 0 12px",
        fontSize: "20px",
        fontWeight: 700,
        color: INK,
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </Text>
  )
}

export function P({ children }: { children: ReactNode }) {
  return <Text style={{ margin: "0 0 16px", color: INK }}>{children}</Text>
}
