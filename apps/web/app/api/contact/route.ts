import { NextResponse } from "next/server"

// Contact form submissions land here. Like /api/waitlist, there's no datastore
// or email provider wired yet: this validates the payload and acknowledges it
// (server logs capture it, and the client mirrors it into PostHog as a
// `contact_submitted` event so messages are readable there for now). Swap the
// console.log for a real store / provider (Resend, Loops, a DB insert) when one
// is chosen — the client contract stays the same: POST { name?, email, message }
// → 200 { ok: true }.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  console.log(
    `[contact] from ${cleanName || "(no name)"} <${email
      .trim()
      .toLowerCase()}>: ${message.trim()}`
  )

  return NextResponse.json({ ok: true })
}
