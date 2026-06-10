---
id: content-negotiation
name: Markdown content negotiation
category: Crawl surface
pillars: [geo]
tier: A
fixable: true
scope: per-page
priority: medium
---

# content-negotiation — serve the Markdown twin to AI clients

## What it checks & why
A `.md` twin only helps if AI clients actually receive it. The scan re-requests the HTML URL two
ways: with `Accept: text/markdown`, and with a known AI-bot `User-Agent` (GPTBot, ClaudeBot,
PerplexityBot, ...). A conformant site returns the markdown twin for both, instead of the JS-heavy
HTML. This is HTTP content negotiation (RFC 7231) — the same URL, two representations.

## Pass bar
pass = both `Accept: text/markdown` and an AI-bot User-Agent receive markdown. partial = only one of
the two does. fail = the HTML URL never returns markdown to AI clients.

## How to fix (hand-written middleware — never add a third-party dependency)
Add a small middleware / edge handler that runs before the HTML route and, when the request prefers
markdown, serves the twin:
- Trigger when `Accept` includes `text/markdown` **or** the `User-Agent` matches a known AI bot
  (GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended,
  CCBot, and similar).
- Respond with the page's markdown twin body (reuse the same source as `markdown-twin`).
- **Next.js** → `middleware.ts` (or `proxy.ts`) that rewrites/returns the `.md` body for matched
  requests. **Astro** → middleware in `src/middleware.ts`. **SvelteKit** → `handle` in
  `src/hooks.server.ts`. **Edge (Cloudflare/Vercel/Deno)** → wrap the fetch handler.
- Always set `Vary: Accept` on the negotiated response — both representations (see
  `ai-delivery-headers`).
- Spec SHOULD (informational in scans, never scored): when the `Accept` header matches neither
  `text/html` nor `text/markdown` nor a wildcard, return `406 Not Acceptable`. Implement it when
  trivial in the same middleware; never break default HTML serving for it.

## Auto-fix vs flag
Pure delivery/config: safe to add. Do not change the HTML representation humans get. If the stack
cannot run middleware (pure static host with no edge), flag it.

## Verify
Re-request the page with `Accept: text/markdown` and with a GPTBot UA (e.g. `curl -H`); both return
`text/markdown`. Browsers still get HTML. Build passes.

## Skip or flag when
Negotiation already works → no-op. No twin exists yet → fix `markdown-twin` first.
