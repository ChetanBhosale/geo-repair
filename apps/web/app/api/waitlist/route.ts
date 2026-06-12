import { NextResponse } from "next/server"

import { sendEmail } from "@repo/email"

// Waitlist signups land here. There's no datastore yet, so a durable list still
// depends on the DB-storage task; for now we send a welcome email via Resend and
// log the signup (server logs are the record of who joined in the meantime).
// The email send is best-effort and never fails the request. Client contract:
// POST { email } → 200 { ok: true }.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  let email: unknown
  try {
    ;({ email } = await request.json())
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 }
    )
  }

  const address = email.trim().toLowerCase()
  console.log(`[waitlist] signup: ${address}`)

  // Best-effort: a failed welcome email shouldn't reject an accepted signup.
  await sendEmail("waitlistWelcome", {}, { to: address }).catch((err) => {
    console.error("[email] waitlist welcome failed:", err)
  })

  return NextResponse.json({ ok: true })
}
