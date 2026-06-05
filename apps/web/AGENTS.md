<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Product copy

- **No em dashes anywhere in the product.** Never use the em dash character (U+2014)
  in any customer-facing copy, metadata, JSON-LD, OG text, alt text, or UI string.
  Use commas, colons, periods, or parentheses instead and rewrite the sentence if
  needed. (En dashes in numeric ranges like "0–100" are fine.) This applies to all
  rendered strings; do not reintroduce them.
- **Humanize new content before shipping.** When writing or editing landing-page copy,
  blog metadata, blog MDX, Markdown twins, `llms.txt`, OG text, or other public
  marketing content, use the `humanizer` skill (`~/.codex/skills/humanizer/SKILL.md`)
  as a review pass before declaring the work done. Remove obvious AI-writing tells:
  keyword lists that read stuffed, "not just / not only" constructions, vague promo
  words like "valuable" or "showcase," mechanical bold-label lists, title-case
  headings where sentence case reads better, and em/en dashes in final copy.

## Visual style

- **No shadows. Anywhere. Ever.** Never use `box-shadow` / Tailwind `shadow-*`
  (or `drop-shadow-*`) on any element in the product or marketing site. This is a
  hard rule. Elevation and separation come from **borders and color** (white blocks
  on an off-white page), never from shadows.
- **Blocky, contained layout.** Sections read as engineering-style framed blocks:
  thin `border-border` frames with **sharp corners** (no radius on content frames),
  cells divided by hairline rules (`gap-px` over `bg-border`), and small corner
  markers on the frames. The brand-color hero and closing CTA panels are the only
  rounded surfaces; buttons stay pill-shaped. Everything else is square and gridded.

## Feature graphics

- **Feature graphics may be replicas of the actual software.** Instead of generic
  illustrations, build the marketing feature graphics (the report card, the PR
  preview, the scanning sequence, etc.) as faithful, self-contained recreations of
  real product UI. They can be interactive and animated purely through code (CSS /
  canvas / small client components) rather than static images, as long as they stay
  SSR-friendly and do not regress the rubric. The mono ("code") type is appropriate
  inside these surfaces so they read as the real tool.

## Legal pages

The Privacy Policy ([`app/(marketing)/privacy/page.tsx`](<app/(marketing)/privacy/page.tsx>))
and Terms ([`app/(marketing)/terms/page.tsx`](<app/(marketing)/terms/page.tsx>)) describe
real product behavior and data handling. They must stay accurate.

- **Keep them in sync with reality.** Whenever a change alters what data the product
  collects, how it is processed, who it is shared with, or any sub-processor (analytics
  provider, email provider, payment processor, hosting, the repo access model, retention,
  etc.), update the affected legal copy in the same change. Treat the legal pages as part
  of the surface you touched, not a separate follow-up.
- **Bump the date.** When you make a material change to either page, update its
  `LAST_UPDATED` constant to the current date. Both pages render this as the
  "Last updated" line, so a stale constant silently misrepresents the policy.
- **New third-party processors must be disclosed.** Adding a service that receives user
  data (for example Resend for transactional email, a new analytics tool, a CRM) means the
  Privacy Policy's "what we collect" / "third-party sharing" wording needs to reflect it
  before the integration ships.
- **Both pages move together when shared facts change.** Contact addresses, company
  identity, and data-handling claims appear in both; update both so they never disagree.

## Analytics & events

PostHog tracking is required on insightful surfaces (see the root `AGENTS.md` Analytics
section for the policy and naming rules). Web-specific conventions:

- **Use the helper, not raw `posthog.capture`.** Fire events through `capture()` in
  [`lib/analytics.ts`](lib/analytics.ts), whose event names are a typed union. Add new
  events there first so names stay consistent and discoverable.
- **Pageviews are manual.** `$pageview` is captured on App Router route changes by the
  `PostHogPageView` component (autocapture's default pageview misses client-side
  navigations); `capture_pageview` is off in init. Do not re-add automatic pageviews.
- **Autocapture is on** for generic clicks/links, so most link and button clicks (nav,
  footer, blog cards, external links) are captured without per-element code. Add a named
  manual event only when autocapture can't see the signal (form submissions like
  `waitlist_joined`, `<details>` toggles) or when a labelled funnel event adds value
  (e.g. `cta_clicked` with a `location`).
- **Stay SSR-friendly.** PostHog init is client-only and runs after hydration. Keep the
  provider as the single client boundary; don't turn server pages into client components
  just to add tracking. Use a small client island instead. No render-blocking script, no
  layout shift, no rubric regression.
