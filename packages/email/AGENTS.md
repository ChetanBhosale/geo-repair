# AGENTS.md — @repo/email

Shared transactional email for every app. **If you are building a feature that should
notify a user by email, send it from here — do not hand-roll Resend calls or inline HTML
in an app.** This package owns the Resend client, the branding, and every template.

## When to wire a template (READ THIS FIRST)

The templates already exist. As each product segment comes online, wire the matching
template at the trigger site listed below. Send is best-effort and must never block or
break the work that triggered it (`await … .catch(() => {})`).

| You are building… | Send this template | Trigger (status transition / event) | Recipient |
| --- | --- | --- | --- |
| **Auth** (OAuth user creation) | `accountWelcome` | first time a `User` row is created (not on link/refresh), in `auth.service.ts` | `user.email` |
| **Free checkup / scan** | `checkupComplete` | `Scraping` → `COMPLETED` | logged-in `user.email`, or the anonymous `notifyEmail` captured on the checkup form |
| **Free checkup / scan** | `scanFailed` | `Scraping` → `FAILED` | same as above |
| **Billing** (Dodo webhook) | `paymentReceipt` | `BillingOrder` → `PAID` | `user.email` |
| **Billing** | `paymentFailed` | `BillingOrder` → `FAILED` | `user.email` |
| **Billing** | `refund` | `BillingOrder` → `REFUNDED` | `user.email` |
| **Fix agent** | `fixPlanReady` | `AgentPlan` → `AWAITING_USER` / run `AWAITING_INPUT` | `user.email` |
| **Fix agent** | `fixPrOpened` | `AgentRun` → `PR_OPENED` (also the no-change `COMPLETED` case) | `user.email` |
| **Fix agent** | `fixFailed` | `AgentRun` → `FAILED` | `user.email` |
| **Fix agent** | `aiCreditsExhausted` | computed order AI credits left hits 0 after follow-up usage | `user.email` |
| **Waitlist** (live today) | `waitlistWelcome` | `POST /api/waitlist` | submitted email |
| **Contact** (live today) | `contactNotification` + `contactAck` | `POST /api/contact` | team inbox + submitter |

Product flows, statuses, and trigger files are described in [`plan/plan.md`](../../plan/plan.md)
and the schema in [`packages/db/prisma/schema.prisma`](../db/prisma/schema.prisma).

### Two rules that are DEFERRED — do them when you wire, not before

1. **Presence-aware suppression.** The scan and fix emails (`checkupComplete`, `scanFailed`,
   `fixPlanReady`, `fixPrOpened`, `fixFailed`, `aiCreditsExhausted`) should be skipped if the
   user was active in the dashboard when the event fired (they already saw it in-app).
   When you build the dashboard, add `User.lastSeenAt` (heartbeat + piggyback on polled
   endpoints) and gate these sends on `now - lastSeenAt > threshold`. Welcome, billing,
   waitlist, and contact are **never** suppressed. Anonymous checkups (no user) always send.
2. **Idempotency.** `COMPLETED`/`FAILED`/`PR_OPENED` can be written by both the worker and a
   reconcile path. Guard sends with a `notifiedAt` column so a user never gets two emails for
   one event.

## How to use it

```ts
import { sendEmail } from "@repo/email"

// Best-effort: returns { ok } | { skipped: true } | { ok:false, error }. Never throws.
await sendEmail("paymentReceipt", {
  tier: "Growth", amountCents: 14900, currency: "USD", website: "acme.com",
}, { to: user.email })
```

`sendEmail(id, props, opts)` renders the template to HTML + plain text and sends via Resend.
Props are fully typed per template (see `src/registry.ts` → `TemplatePropsMap`). The subject
defaults to the template's own builder; override with `opts.subject`. `opts.replyTo` is
supported (used by `contactNotification`).

Env: `RESEND_API_KEY` (required to actually send; absent → `{ skipped: true }`), `EMAIL_FROM`
(default `GEO Repair <hello@geo.repair>`).

## Conventions

- **React Email only.** Templates are `.tsx` in `src/templates/`, built from the shared
  `Layout`/`Button`/`Footer` in `src/components/`. No raw HTML strings, no per-app email code.
- **Branding lives in `src/theme.ts`** (emerald `#047857`, ink, muted, `SITE`, `LOGO_URL`).
  Don't hardcode colors in templates.
- **Logo:** the header mark is `LOGO_URL` → `https://geo.repair/email-logo.png` (emerald PNG
  in `apps/web/public`, matching the wordmark). SVG is intentionally avoided — Gmail/Outlook
  strip it. If you change the asset, redeploy the web app or the icon 404s in real emails.
- **Copy is humanized** (no em/en dashes, no emoji, no AI-vocabulary or tailing negations).
  Keep new copy that way — see `~/.codex/skills/humanizer`.
- **Never throw from a send.** Callers `await` but the trigger work must not depend on it.

## Adding a template

1. Add `src/templates/MyTemplate.tsx` — default-export the component, export its `Props` type,
   attach `MyTemplate.PreviewProps` with realistic sample data.
2. Register it in `src/registry.ts` (`TemplatePropsMap` + `TEMPLATES` entry with a subject).
3. Preview: `bun run --filter=@repo/email email:dev` (localhost:3030).
4. Type-check: `bun run --filter=@repo/email check-types`.
5. Visual smoke test to a real inbox: `RESEND_API_KEY=… bun packages/email/scripts/send-tests.ts [recipient]`.
