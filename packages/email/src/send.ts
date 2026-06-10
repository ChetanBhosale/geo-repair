import { createElement } from "react"

import { send, type SendResult } from "./client"
import { renderEmail } from "./render"
import { TEMPLATES, type TemplateId, type TemplatePropsMap } from "./registry"

/**
 * Render a template and send it via Resend. Best-effort — never throws; returns
 * `{ skipped: true }` when RESEND_API_KEY is unset. The subject defaults to the
 * template's own subject builder but can be overridden.
 *
 * Wiring (presence-aware suppression, recipient resolution, trigger sites) is
 * intentionally deferred to a later phase; this is the low-level send used by
 * the preview/test tooling today and by typed senders later.
 */
export async function sendEmail<K extends TemplateId>(
  id: K,
  props: TemplatePropsMap[K],
  opts: { to: string | string[]; replyTo?: string; subject?: string },
): Promise<SendResult> {
  const tpl = TEMPLATES[id]
  const element = createElement(tpl.component, props)
  const { html, text } = await renderEmail(element)
  return send({
    to: opts.to,
    subject: opts.subject ?? tpl.subject(props),
    html,
    text,
    replyTo: opts.replyTo,
  })
}
