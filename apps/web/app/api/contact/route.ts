import { NextResponse } from "next/server"

import { sendEmail } from "@repo/email"

// Contact form submissions land here. There's no datastore yet, so we notify the
// team inbox via Resend and send the submitter an acknowledgement; the message is
// also logged and mirrored into PostHog (`contact_submitted`) client-side. Email
// sends are best-effort and never fail the request. Client contract:
// POST { name?, email, message } → 200 { ok: true }.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CONTACT_NOTIFY_TO =
  process.env.CONTACT_NOTIFY_TO ?? "ajayveyron9@gmail.com"

export async function POST(request: Request) {
  let body: { name?: unknown; email?: unknown; message?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const { name, email, message } = body

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 }
    )
  }

  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: "A message is required." },
      { status: 400 }
    )
  }

  const cleanName = typeof name === "string" ? name.trim() : ""
  const cleanEmail = email.trim().toLowerCase()
  const cleanMessage = message.trim()

  console.log(
    `[contact] from ${cleanName || "(no name)"} <${cleanEmail}>: ${cleanMessage}`
  )

  // Best-effort: notify the team and acknowledge the sender. A failed email
  // shouldn't reject a submission the form has already accepted.
  await Promise.allSettled([
    sendEmail(
      "contactNotification",
      {
        name: cleanName,
        email: cleanEmail,
        message: cleanMessage,
      },
      { to: CONTACT_NOTIFY_TO, replyTo: cleanEmail }
    ),
    sendEmail("contactAck", { name: cleanName }, { to: cleanEmail }),
  ])

  return NextResponse.json({ ok: true })
}
