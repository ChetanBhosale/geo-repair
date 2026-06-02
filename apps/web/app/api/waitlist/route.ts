import { NextResponse } from "next/server"

// Waitlist signups land here. There's no datastore or email provider wired yet,
// so this validates the address and acknowledges it (server logs capture the
// signup in the meantime). Swap the console.log for a real store / provider
// (Resend, Loops, a DB insert) when one is chosen — the client contract stays
// the same: POST { email } → 200 { ok: true }.
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

  console.log(`[waitlist] signup: ${email.trim().toLowerCase()}`)

  return NextResponse.json({ ok: true })
}
