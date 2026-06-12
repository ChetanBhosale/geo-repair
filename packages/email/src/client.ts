import { Resend } from "resend"

import { SITE } from "./theme"

// Transactional email via Resend. Sends are best-effort: callers await the
// result but should never fail their own work on a send error. Ported from the
// original apps/web/lib/email.ts so behavior is identical.
//
// Required env:
//   RESEND_API_KEY    - server-side API key
// Optional env:
//   EMAIL_FROM        - verified sender, default "GEO Repair <hello@geo.repair>"

// Lazy singleton: instantiating Resend reads the key once, and a missing key is
// reported as "not configured" rather than throwing at import time (which would
// take down any route in environments where email isn't set up yet).
let client: Resend | null = null
function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!client) client = new Resend(key)
  return client
}

export type SendResult = { ok: boolean; skipped?: boolean; error?: string }

export async function send(opts: {
  to: string | string[]
  subject: string
  html: string
  text: string
  replyTo?: string
}): Promise<SendResult> {
  const r = resend()
  if (!r) {
    console.warn("[email] RESEND_API_KEY not set, skipping send:", opts.subject)
    return { ok: false, skipped: true }
  }
  try {
    const from = process.env.EMAIL_FROM ?? `${SITE.name} <hello@geo.repair>`
    const { error } = await r.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    })
    if (error) {
      console.error("[email] send failed:", opts.subject, error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    console.error("[email] send threw:", opts.subject, err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
