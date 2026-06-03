import { Resend } from "resend"

import { SITE } from "./seo"

// Transactional email via Resend. The forms (waitlist + contact) call into here
// after validating their payload. Sends are best-effort: callers await the
// result but never fail the HTTP request on a send error. The form has already
// been accepted, and a dropped email shouldn't surface as a user-facing error.
//
// Required env:
//   RESEND_API_KEY    - server-side API key (already in .env.local)
// Optional env (sensible defaults below):
//   EMAIL_FROM        - verified sender, default "GEO Repair <hello@geo.repair>"
//   CONTACT_NOTIFY_TO - inbox that receives contact-form submissions

const FROM = process.env.EMAIL_FROM ?? `${SITE.name} <hello@geo.repair>`
const CONTACT_NOTIFY_TO =
  process.env.CONTACT_NOTIFY_TO ?? "ajayveyron9@gmail.com"

// Lazy singleton: instantiating Resend reads the key once, and a missing key is
// reported as "not configured" rather than throwing at import time (which would
// take down the route in environments where email isn't set up yet).
let client: Resend | null = null
function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!client) client = new Resend(key)
  return client
}

// Brand palette mirrored from app/globals.css (emerald primary, soft near-black).
const ACCENT = "#047857"
const INK = "#262626"
const MUTED = "#6b7280"

function layout(bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f6;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #ececec;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px;">
                <span style="font-size:15px;font-weight:700;color:${ACCENT};letter-spacing:-0.01em;">${SITE.name}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px;color:${INK};font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
          </table>
          <p style="max-width:520px;margin:16px auto 0;color:${MUTED};font-size:12px;line-height:1.5;text-align:center;">
            ${SITE.name} · ${SITE.tagline} · <a href="${SITE.url}" style="color:${MUTED};">geo.repair</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:8px;">${label}</a>`
}

type SendResult = { ok: boolean; skipped?: boolean; error?: string }

async function send(opts: {
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
    const { error } = await r.emails.send({
      from: FROM,
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

/** Welcome email sent to a new waitlist signup. */
export function sendWaitlistWelcome(email: string): Promise<SendResult> {
  const html = layout(`
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:${INK};letter-spacing:-0.01em;">You're on the list 🎉</h1>
    <p style="margin:0 0 16px;">
      Thanks for joining the ${SITE.name} waitlist. We're building a free checkup that
      shows how ready your site is for AI search engines like ChatGPT, Perplexity, and
      Google AI Overviews, then ships a pull request that fixes it.
    </p>
    <p style="margin:0 0 24px;">
      We'll email you the moment your spot opens up. No code required.
    </p>
    <p style="margin:0 0 8px;">${button("Visit GEO Repair", SITE.url)}</p>
  `)
  const text = `You're on the list 🎉

Thanks for joining the ${SITE.name} waitlist. We're building a free checkup that shows how ready your site is for AI search engines like ChatGPT, Perplexity, and Google AI Overviews, then ships a pull request that fixes it.

We'll email you the moment your spot opens up. No code required.

${SITE.url}`

  return send({
    to: email,
    subject: `You're on the ${SITE.name} waitlist`,
    html,
    text,
  })
}

/** Internal notification to the team for a new contact-form submission. */
export function sendContactNotification(input: {
  name: string
  email: string
  message: string
}): Promise<SendResult> {
  const { name, email, message } = input
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />")
  const html = layout(`
    <h1 style="margin:0 0 12px;font-size:18px;font-weight:700;color:${INK};">New contact form submission</h1>
    <p style="margin:0 0 6px;"><strong>Name:</strong> ${escapeHtml(name) || "(not provided)"}</p>
    <p style="margin:0 0 6px;"><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color:${ACCENT};">${escapeHtml(email)}</a></p>
    <p style="margin:16px 0 6px;"><strong>Message:</strong></p>
    <div style="background:#f6f7f6;border-radius:8px;padding:14px 16px;color:${INK};">${safeMessage}</div>
  `)
  const text = `New contact form submission

Name: ${name || "(not provided)"}
Email: ${email}

Message:
${message}`

  return send({
    to: CONTACT_NOTIFY_TO,
    subject: `Contact form: ${name || email}`,
    html,
    text,
    // Replying in the inbox goes straight to the person who reached out.
    replyTo: email,
  })
}

/** Acknowledgement sent back to whoever submitted the contact form. */
export function sendContactAck(input: {
  name: string
  email: string
}): Promise<SendResult> {
  const { name, email } = input
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi there,"
  const html = layout(`
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:${INK};letter-spacing:-0.01em;">Thanks for reaching out</h1>
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 16px;">
      We got your message and someone from the ${SITE.name} team will get back to you
      shortly. In the meantime, feel free to explore the site.
    </p>
    <p style="margin:0 0 8px;">${button("Visit GEO Repair", SITE.url)}</p>
  `)
  const text = `Thanks for reaching out

${name ? `Hi ${name},` : "Hi there,"}

We got your message and someone from the ${SITE.name} team will get back to you shortly.

${SITE.url}`

  return send({
    to: email,
    subject: `Thanks for contacting ${SITE.name}`,
    html,
    text,
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
