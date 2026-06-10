import { Link, Text } from "@react-email/components"

import { Layout } from "../components/Layout"
import { ACCENT, BG, INK } from "../theme"

export type ContactNotificationProps = {
  name?: string
  email: string
  message: string
}

/** Internal notification to the team for a new contact-form submission. */
export default function ContactNotification({
  name,
  email,
  message,
}: ContactNotificationProps) {
  return (
    <Layout preview={`Contact form: ${name || email}`}>
      <Text
        style={{
          margin: "0 0 12px",
          fontSize: "18px",
          fontWeight: 700,
          color: INK,
        }}
      >
        New contact form submission
      </Text>
      <Text style={{ margin: "0 0 6px", color: INK }}>
        <strong>Name:</strong> {name || "(not provided)"}
      </Text>
      <Text style={{ margin: "0 0 6px", color: INK }}>
        <strong>Email:</strong>{" "}
        <Link href={`mailto:${email}`} style={{ color: ACCENT }}>
          {email}
        </Link>
      </Text>
      <Text style={{ margin: "16px 0 6px", color: INK }}>
        <strong>Message:</strong>
      </Text>
      {/* React Email escapes interpolated text, so user-supplied content is safe
          without a manual escapeHtml(). Newlines are preserved via whiteSpace. */}
      <Text
        style={{
          background: BG,
          borderRadius: "8px",
          padding: "14px 16px",
          color: INK,
          whiteSpace: "pre-wrap",
        }}
      >
        {message}
      </Text>
    </Layout>
  )
}

ContactNotification.PreviewProps = {
  name: "Jordan Rivera",
  email: "jordan@acme.com",
  message: "Hey, does the fix agent support Next.js App Router?\n\nThanks!",
} satisfies ContactNotificationProps
