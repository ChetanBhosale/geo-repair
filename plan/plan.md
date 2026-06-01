# GEO Repair — Refined Plan

## Context

GEO Repair is a SaaS that fixes **GEO** (Generative Engine Optimization) and **AEO**
(Answer Engine Optimization) for **custom-coded** websites by opening a fix PR on the
user's GitHub repo. The wedge: a free GEO/AEO checkup that produces a score, then a paid
"one-click fix" where an AI coding agent runs in a sandbox and raises a PR.

The repo today is a clean Turborepo scaffold (Next.js 16.2 App Router, React 19, Bun, TS;
deployable to Vercel). This document refines the founder's product narrative into a buildable
plan: it closes gaps (repo↔site mapping, build-safety, secret handling, honest outcome
messaging), finalizes pricing, and defines the technical architecture and build sequence.

**Decisions locked with the founder:**
- **Payment:** charge fully upfront — *plus* a pre-payment feasibility gate and an
  automatic refund if no build-passing PR is produced (protects reputation given upfront billing).
- **Pricing:** **$19 / $99 / $199 + custom**, tiered by sitemap page count.
- **Agent engine:** **opencode CLI** (open-source agentic harness) driving **Opus via OpenRouter**
  — gives both a ready-made tool loop *and* native model-swappability.
- **Scope:** support **any custom-coded site** (Next.js, Astro, Remix, SvelteKit, Vite SPA,
  static HTML, …), with framework auto-detection and graceful fallback when a stack can't be safely fixed.

> **Honesty guardrail (applies throughout):** we improve **technical GEO readiness immediately**.
> Actual outcomes (being cited by ChatGPT/Perplexity/Google AI) take weeks and aren't guaranteed.
> All copy, the re-check, and refund policy must reflect this — never promise citations or traffic.

---

## Refined end-to-end flow

1. **Landing → Free checkup.** User enters a URL. We crawl a sample of pages + `sitemap.xml`.
   Rate-limited (per-IP + per-domain) and cached per domain (~24h).
2. **No-code gate (before anything else).** Fingerprint the platform (headers, generator meta,
   asset domains, `wp-json` probe). If Framer / Webflow / Wix / WordPress / Squarespace / Shopify →
   show **"Coming soon"** + waitlist capture. Never proceed to GitHub.
3. **Score + quote (no login yet).** For custom sites, show the GEO/AEO score breakdown, the failing
   checks, the **sitemap page count**, and the **recommended plan/price** — all from public data, so we
   qualify intent *before* asking for repo access. CTA: **"One Click Fix."**
4. **Connect GitHub (App install + login).** Install our **GitHub App** on the **single** repo
   (not "all repos"). Account is created; user lands on the dashboard.
5. **Repo ↔ site confirmation.** We resolve which connected repo builds the checked URL and show our
   evidence ("we think `org/repo` builds `example.com`"). User must **confirm** before we charge or run.
   This closes a real gap — the live URL doesn't inherently map to a repo.
6. **Feasibility gate + payment (upfront).** Confirm it's a supported, buildable stack (framework detected,
   build/typecheck strategy known). Then charge the tiered one-time fee. If the stack is unsupported, route
   to waitlist instead of charging.
7. **Run the fix.** User presses **Start fix** (could auto-start on payment). A sandbox spins up; the agent
   clones, installs, fixes only the rubric's failing checks, runs build + typecheck, and opens a PR.
8. **Live read-only stream.** User watches a chat-style transcript of the agent (pull → install → find files →
   edit → build/typecheck → open PR). Refresh-safe (persisted run log).
9. **PR ready.** Show **View PR / Merge** buttons. If the agent can't produce a build-passing PR → mark failed
   and **auto-refund** (the upfront-billing safeguard).
10. **Merge detected (webhook) → re-check.** On PR merge, prompt an updated checkup using our internal checker
    **and** third-party tools; show the **readiness delta** (not a traffic promise).
11. **Upsell — GEO Autopilot ($9/mo).** Continuous monitoring: re-scan on `push` + on a schedule, catch
    regressions (new pages without schema, content changes), and open up to N improvement PRs/month.

---

## The GEO/AEO checker rubric (`@repo/checker` — core IP)

One deterministic, **versioned** rubric, shared by the free checkup, the agent's fix targets, and the re-check
(so the re-check can never disagree with what we sold). Each check returns
`{ id, category, weight, status: pass|partial|fail, evidence, fixable_by_agent, fix_hint }` → weighted 0–100 + subscores.

1. **AI-crawler content visibility (SSR vs CSR) — highest weight.** Fetch raw no-JS HTML; if main content only
   appears after hydration, the site is largely invisible to AI crawlers — *the* critical custom-site failure.
2. **Structured data** — JSON-LD/schema.org presence + validity (Organization, WebSite, Article, FAQPage, BreadcrumbList).
3. **`llms.txt`** at `/llms.txt`.
4. **robots.txt AI-crawler rules** — GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot; flag accidental blocks.
5. **Semantic HTML / heading hierarchy** (single h1, landmarks).
6. **Meta + Open Graph / Twitter cards.**
7. **Canonical URLs.**
8. **Sitemap** present/valid/referenced (also drives pricing).
9. **Answerability / Q&A structure** (FAQ blocks, question-shaped headings) — AEO core.
10. **Image alt-text coverage.**
11. **Internal linking** (descriptive anchors, orphan pages).
12. **Freshness / E-E-A-T** (dates, author, about/contact).

`fixable_by_agent` checks become the agent's **bounded task list** — this is also the primary cost control
(the agent only touches flagged checks, never free-roams). **Anti-abuse:** Upstash Redis rate-limit (per-IP +
per-domain), cached results, fetch timeouts/size caps, respect target `robots.txt`, concurrency-limit our crawler.

---

## Pricing (finalized)

Tiered one-time fee by **sitemap page count**, computed server-side at quote time and stored on the order
(auditable, tamper-proof):

| Tier | Pages | Price |
|------|-------|-------|
| Starter | ≤ 25 | **$19** |
| Growth | 26–100 | **$99** |
| Pro | 101–200 | **$199** |
| Custom | > 200 | contact / per-page overage |

~\$1/page, clean to justify. Tier-1 widened to ≤25 to soften the boundary cliff. **Charge upfront**, but only
after the repo↔site confirmation + feasibility gate; **auto-refund** if no build-passing PR is produced.
Track `token_cost_cents` + `sandbox_cost_cents` per run and alert if a run approaches its price (margin guard).

**Subscription — GEO Autopilot: $9/mo** (Stripe subscription + Customer Portal).

---

## Technical architecture

**Three planes** (the agent run cannot live on Vercel — it's long-running and executes untrusted repo code):

- **Control plane** — `apps/web` on Vercel: marketing, free checkup, auth, dashboard, Stripe, GitHub
  callbacks/webhooks, realtime read views. Server Actions + Route Handlers only; no long work.
- **Job plane** — **Trigger.dev**: owns the run state machine, retries, concurrency, and realtime fan-out
  to the browser. (Inngest is the viable alternative.)
- **Execution plane** — **E2B** ephemeral sandbox (Firecracker microVM), one per run: clone → install →
  run agent → build/typecheck → open PR → destroy. (Daytona is the fallback.)

**Agent engine — opencode CLI inside the sandbox.**
- opencode is an open-source, provider-agnostic coding agent (tool loop: file edit + bash + build-retry).
  Run it **headless** (`opencode serve` / non-interactive run) so we can drive a session and subscribe to its
  **event stream (SSE)** — which maps cleanly onto our persisted run log and the read-only UI.
- Model: **Opus via OpenRouter** by default; swappable through opencode's provider config (this is how we get
  the founder's model-swappability goal "for free").
- We wrap it with our **custom system prompt + the rubric's failing-check list** as the bounded task (via
  opencode rules/AGENTS.md + a custom agent definition). **Pin a version** (young, fast-moving project) and
  normalize its events into our schema in `@repo/agent`.

**Realtime streaming (durable + refresh-proof), two layers:**
1. **Source of truth:** every agent event → append-only `run_events` (ordered `seq`). Refresh hydrates the full
   transcript from DB.
2. **Live layer:** Trigger.dev Realtime pushes events as they happen; client hydrates from DB then subscribes for
   `seq > lastSeen`. (Fallback: SSE route over Upstash Redis pub/sub.) View is strictly read-only. Avoid raw
   WebSockets on Vercel.

**GitHub — GitHub App (not OAuth App), also used for login.** Per-repo install, scopes `contents:write` +
`pull_requests:write` + `metadata:read`; short-lived installation tokens minted per run server-side (never in
the browser, scrubbed from sandbox logs). Webhooks: `pull_request` (merge detection), `installation`,
`installation_repositories`, `push` (Autopilot). **Repo↔site resolver** (highest confidence first): hosting/deploy
fingerprints → repo-signal scan (`package.json` homepage, `vercel.json`/`netlify.toml`, `CNAME`, env refs) → optional
build-time sentinel verification → always confirm with the user before charging.

**Payments — Stripe.** One-time tiered price computed from page count (stored on `orders`); $9/mo subscription.
Charge upfront per the locked decision; gate the charge behind repo confirmation + feasibility; **auto-refund** on
run failure / no-op diff.

**Data model** (Postgres on **Neon** + **Drizzle**, `@repo/db`):
`users` · `github_installations` · `sites` · `site_repo_links (confidence, evidence, confirmed_by_user)` ·
`checkups (score, subscores, raw_findings, is_ssr, rubric_version, source)` ·
`orders (sitemap_page_count, tier, amount_cents, stripe_payment_intent_id, refund_state)` ·
`fix_runs (state, token_cost_cents, sandbox_cost_cents, error)` ·
`run_events (seq, type, phase, payload)` ·
`pull_requests (pr_number, url, build_passed, types_passed, merged_at)` ·
`subscriptions` · `monitor_runs` (Autopilot).

**Run state machine** (`fix_runs.state`):
`queued → cloning → installing → fixing → verifying → pr_opened → merged`
- `verifying` loops back to `fixing` on build/type failure (bounded retries).
- Any active state → `failed` (records `error`) → **trigger auto-refund**.
- `pr_opened` un-merged after N days → `stale`.
- Every transition writes a `run_events` row.

---

## Key risks & mitigations (tuned to upfront-billing + any-site)

1. **Paid upfront, then the run fails / produces a no-op** (compounded by broad framework scope) →
   pre-payment **feasibility gate** (detect framework + a real build/typecheck strategy before charging) +
   **no-op diff detector** + **automatic refund** when no build-passing PR is produced. Make the refund policy
   explicit in checkout copy.
2. **Breaking the user's build** → agent MUST pass `build` + `check-types` in-sandbox before opening the PR;
   **PR-only on a branch**, never push to the default branch.
3. **Secret exfiltration from the sandbox** → egress allowlist (GitHub/npm/model endpoints only), no DB/Stripe
   creds in the sandbox, short-lived token scrubbed from logs, hard teardown, ephemeral per-run creds.
4. **Over-promising GEO outcomes** → UI/re-check report "technical readiness improved," never "you'll be cited."
5. **Broad framework reliability** → start every run with framework detection; static HTML sites skip `tsc` and use
   lighter HTML validation; unknown/unbuildable stacks hit the feasibility gate (waitlist, no charge).
6. **Unit economics on $99/$199 tiers** → per-run hard token + max-files + wall-clock caps; cheaper triage model for
   file-finding, Opus only for edits; cost tracked per run with margin alerts.

---

## Build sequencing

- **P0 — Foundations:** workspace packages (`@repo/db` Drizzle+Neon, `@repo/shared` zod types + run-state enums),
  auth scaffold, base UI/dashboard shell.
- **P1 — Free checkup (standalone funnel):** `@repo/checker` rubric, no-code gate, Upstash rate-limit + cache,
  public score page + sitemap page-count quote. *Ships value with no GitHub/agent/payments.*
- **P2 — GitHub App:** registration, login, single-repo install, repo↔site resolver + confirm UI, webhooks.
- **P3 — Agent run:** Trigger.dev task + state machine, E2B template (Bun/Node + opencode preinstalled),
  `@repo/agent` (opencode driver + normalized event contract + system prompt), `run_events`, realtime read view.
- **P4 — Payments:** tiered sitemap quote, upfront charge gated by feasibility + repo confirmation, auto-refund
  on failure, COGS tracking.
- **P5 — Post-merge + upsell:** merge webhook → re-check (internal + third-party) → readiness delta →
  **$9/mo Autopilot** (push/cron → improvement PRs).

### New workspace packages / key files
- `packages/db` — Drizzle schema + Neon client (`@repo/db`)
- `packages/shared` — zod types, run-state enums, event contract (`@repo/shared`)
- `packages/checker` — rubric engine (`@repo/checker`)
- `packages/agent` — opencode driver + system prompt + event normalizer (`@repo/agent`)
- `packages/github` — Octokit + GitHub App auth (`@repo/github`)
- `apps/web/app/(marketing)` — landing + free checkup + waitlist
- `apps/web/app/(app)` — dashboard, run view (realtime), repo-confirm, checkout
- `apps/web/app/api/webhooks/{github,stripe}` — webhook handlers
- `trigger/` — Trigger.dev task(s) for the fix run + Autopilot
- Update `turbo.json` (task graph + env passthrough) and root `package.json` (register new packages)

---

## Verification

- **P1:** run the checker against a known SSR site (e.g. a Next.js marketing site) and a known CSR-only SPA;
  confirm the SSR-visibility check correctly flags the SPA, and that scores/subscores are reproducible across runs.
  Confirm the no-code gate flags a WordPress/Framer/Webflow/Wix URL → waitlist. Verify rate-limit + cache via repeated
  requests.
- **P2:** install the GitHub App on a test repo, confirm the repo↔site resolver surfaces the right repo with evidence,
  and that the confirm step blocks progression until accepted. Fire a test `pull_request` merge webhook → state advances.
- **P3:** trigger a fix run end-to-end on a test Next.js repo: watch the live transcript, confirm refresh replays the full
  log from DB, confirm build + typecheck run in-sandbox and a PR opens on a branch (never main). Repeat on a static-HTML
  repo to confirm the framework-detection / no-`tsc` path.
- **P4:** Stripe test mode — confirm the correct tier is computed from sitemap count, upfront charge succeeds only after
  repo confirmation + feasibility, and a forced run failure triggers an automatic refund.
- **P5:** merge a fix PR → confirm re-check runs (internal + a third-party tool) and shows a readiness delta; subscribe to
  Autopilot and confirm a `push`/cron triggers a monitor run.

## Open items to validate during build
- opencode headless event API shape + version pinning (driver in `@repo/agent`).
- E2B template build (Bun + opencode) and egress allowlist enforcement.
- Third-party GEO/AEO checker(s) to pair with our internal re-check.
- Exact sitemap edge cases (sitemap index files, missing sitemap → fallback crawl for page count).
