// Sends one of every template (with its sample props) to a single inbox so the
// designs can be reviewed visually. Best-effort, sequential, with a small delay
// to stay under Resend's rate limit.
//
// Usage:
//   RESEND_API_KEY=re_... bun packages/email/scripts/send-tests.ts [recipient]
//
// Defaults the recipient to ajayveyron9@gmail.com.

import { sendEmail } from "../src/send"
import { TEMPLATES, type TemplateId } from "../src/registry"

const TO = process.argv[2] ?? "ajayveyron9@gmail.com"

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.error(
      "RESEND_API_KEY is not set. Run with: RESEND_API_KEY=re_... bun packages/email/scripts/send-tests.ts",
    )
    process.exit(1)
  }

  const ids = Object.keys(TEMPLATES) as TemplateId[]
  console.log(`Sending ${ids.length} test templates to ${TO}…\n`)

  let ok = 0
  for (const id of ids) {
    const tpl = TEMPLATES[id]
    const subject = `[TEST] ${id}: ${tpl.subject(tpl.sample as never)}`
    const result = await sendEmail(id, tpl.sample as never, { to: TO, subject })
    if (result.ok) {
      ok++
      console.log(`  ✓ ${id}`)
    } else {
      console.log(`  ✗ ${id} — ${result.error ?? "skipped"}`)
    }
    // Resend's default rate limit is ~2 req/s; space sends out a bit.
    await new Promise((r) => setTimeout(r, 600))
  }

  console.log(`\nDone: ${ok}/${ids.length} sent.`)
}

main()
