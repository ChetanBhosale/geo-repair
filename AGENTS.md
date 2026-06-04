# AGENTS.md — geo-repair

Repo-wide guidance for AI agents and humans. App-specific rules live in nested
`AGENTS.md` files (e.g. `apps/web/AGENTS.md`); the nearest file wins, and this root
file applies everywhere.

## What this is

**GEO Repair** is a SaaS that fixes **GEO** (Generative Engine Optimization) and **AEO**
(Answer Engine Optimization) for custom-coded websites by opening a fix PR on the user's
GitHub repo. Flow: free AI-search readiness checkup → score + quote → paid one-click fix
where an AI agent runs in a sandbox and raises a build-passing PR.

Three planes (do not collapse them):

- **Control plane** — `apps/web` on Vercel. Marketing, free checkup, auth, dashboard,
  Stripe, GitHub callbacks/webhooks, realtime read views. Server Actions + Route Handlers
  only — **no long-running work here.**
- **Job plane** — Trigger.dev (planned). Owns the run state machine, retries, concurrency.
- **Execution plane** — E2B ephemeral sandbox (planned). One microVM per run: clone →
  install → run the opencode/Opus agent → build/typecheck → open PR → destroy.

The product narrative, rubric, pricing, and architecture live in [`plan/plan.md`](plan/plan.md).
Read it before making product or architecture decisions.

## Stack & tooling

- **Monorepo:** Turborepo `^2.9`. **Package manager: Bun `1.3.3` — use `bun`, never npm/pnpm/yarn.**
- **`apps/web`:** Next.js **16.2** (App Router), React 19, TypeScript (strict), Tailwind v4,
  shadcn/ui, radix-ui, next-themes, Phosphor icons.
- **`packages/agent`:** opencode/Opus fix-agent system prompt + driver (`@repo/agent`).
- **Shared config:** `@repo/ui`, `@repo/eslint-config`, `@repo/typescript-config`.
- **Planned packages:** `@repo/db` (Drizzle + Neon), `@repo/shared` (zod types + run-state
  enums), `@repo/checker` (the rubric engine — core IP), `@repo/github` (Octokit + App auth).

## Commands

Run from the repo root unless noted. Turbo orchestrates per-package tasks.

```sh
bun install                      # install all workspaces
bun run dev                      # turbo dev (all apps)
bun run dev --filter=web         # just the web app
bun run build                    # turbo build (must pass before any deploy)
bun run lint                     # turbo lint
bun run check-types              # turbo check-types (tsc --noEmit)
bun run format                   # prettier write
```

**Before declaring any change done:** `bun run lint && bun run check-types && bun run build`
must all pass. The Vercel deploy runs `build` — if it fails locally it fails in prod.

## ⚠️ Next.js 16 is bleeding-edge

This is **not** the Next.js in your training data. APIs, conventions, and file structure
may differ. Read the relevant guide in `node_modules/next/dist/docs/` before writing app
code, and heed deprecation notices. (See `apps/web/AGENTS.md`.)

## Deployment

- **Host:** Vercel. The Vercel project is connected to GitHub.
- **`git push` to `main` triggers a production build + deploy.** Treat `main` as live.
- **Production URL: https://geo.repair** — this is the canonical origin. `metadataBase`,
  canonicals, sitemap, robots, and OG URLs must all resolve to it.
- **Do not push straight to `main` for non-trivial changes.** Open a PR; Vercel builds a
  preview deployment per PR. Verify the preview (build green + the SEO checks below) before
  merging. A broken `main` is a broken production site.
- Never commit secrets. Runtime config lives in Vercel project env vars; local dev uses
  `.env.local` (gitignored). Document any new required env var in the PR.

## 🎯 SEO / AEO / GEO compliance is non-negotiable — target 100/100

We sell AI-search readiness, so **our own site must pass our own rubric.** Every route is
born compliant — never fixed up later. The authoritative, versioned checklist is
[`RUBRIC.md`](RUBRIC.md) (`@repo/checker`): SSR content visibility, structured data,
robots/sitemap/`llms.txt`, semantics, answerability, freshness / E-E-A-T, and more.
**Treat [`RUBRIC.md`](RUBRIC.md) as the source of truth** and keep this file from drifting
out of sync with it.

Principles that must always hold:

- **Server-render all meaningful content.** No primary content that only appears after client
  hydration — that's the #1 thing AI crawlers miss and the exact failure we charge to fix.
  `'use client'` is for interactivity, never for shipping content.
- **Every route ships complete metadata** (Metadata API: title, description, canonical, OG +
  Twitter) with `metadataBase = https://geo.repair`, plus valid JSON-LD.
- **AI crawlers are explicitly allowed** in `app/robots.ts` (GPTBot, ClaudeBot,
  PerplexityBot, Google-Extended, CCBot); `app/sitemap.ts` and `/llms.txt` stay complete.
- **Every public route stays indexable** — no accidental `noindex` (meta or `X-Robots-Tag`) and
  no Googlebot/Bingbot block; a self-referential canonical. (Eligibility for Google / AI Overviews;
  Search Console verification is separate owner setup, out of our control.)
- **Semantic, accessible, fast:** one `<h1>` + correct hierarchy, landmarks, alt text,
  accessible names on every interactive element (the a11y tree is the "machine-eye view" AI
  agents use to operate a page), descriptive anchors, FAQ/answerability where it fits, WCAG AA,
  healthy Core Web Vitals.

**Planned enforcement:** once `@repo/checker` exists, wire it into CI / a Vercel check so
100/100 is machine-enforced on every PR — not just documented here. Until then this is a hard
review gate.

**Definition of done for any web change:** build green **and** affected routes still satisfy
the rubric (SSR content visible in no-JS HTML, metadata + JSON-LD present, robots/sitemap/
`llms.txt` intact).

## Positioning & honesty guardrails

- **Public copy never says "GEO."** Consumer awareness is near-zero. Customer-facing language
  is "**AI Search Optimization**", "optimize your site for ChatGPT & Perplexity", "make your
  site understandable to AI". GEO/AEO are internal engineering terms only (rubric, package
  names, this doc).
- **Never promise citations or traffic.** We improve _technical readiness_ immediately;
  actual outcomes (being cited by ChatGPT/Perplexity/Google AI) take weeks and aren't
  guaranteed. All copy, the re-check, and the support policy must reflect this.
- **No em dashes in product copy.** Never use the em dash character in any
  customer-facing string (copy, metadata, JSON-LD, OG text, alt text). Use commas,
  colons, periods, or parentheses. See `apps/web/AGENTS.md` for the full rule.

## Trust messaging — the site must communicate this

Repo access is the biggest conversion drop-off, so trust is **copy, not just backend**. These
four promises must be **visible at the moment of decision** (connect-GitHub screen, checkout,
and the public `/security` page) in plain language — and every one must stay literally true,
backed by a real control (see Security below + Trust & Security in [`plan/plan.md`](plan/plan.md)).
Never overstate; if a claim ever stops being enforceable, change the copy, not the truth.

- **Your code is never kept.** The moment the PR is opened (or the run ends/fails), the clone and
  the sandbox are destroyed — we store run metadata and the transcript, never your source.
- **Only the one repo you pick is touched.** Install is scoped to the single selected repo; no
  other repository is ever read, cloned, or modified.
- **No confidential data leaves to third parties.** Your code and secrets are never shared with
  any third party; model calls are inference-only and no secrets/DB/Stripe creds enter the sandbox.
- **Zero data retention, no model training.** The AI providers we route through don't retain your
  data and **never** train on it.

## Security

- Least-privilege everywhere. The GitHub App requests only `contents:write`,
  `pull_requests:write`, `metadata:read` — no org admin, Actions, or Secrets.
- No DB/Stripe/platform credentials ever enter the execution sandbox; per-run short-lived
  tokens only, scrubbed from logs. See the Trust & Security section in `plan/plan.md`.
- Validate at boundaries (user input, webhooks, external APIs). Don't introduce OWASP-top-10
  footguns (injection, XSS, SSRF in the crawler).

## Analytics

- **PostHog** is the analytics tool for this project. Instrument user-facing flows (checkup,
  connect-GitHub, checkout, run views) with consistent, well-named events.
- **Track by default.** Any feature or surface that can reveal product or marketing insight ships
  with PostHog tracking enabled — landing/demo interactions, CTAs, navigation, content engagement,
  forms, funnels. A surface is not "done" until its meaningful interactions emit events. If a new
  surface genuinely has nothing worth measuring, say so in the PR rather than silently skipping it.
- **Event naming.** `snake_case`, `object_action` (e.g. `waitlist_joined`, `cta_clicked`).
  Reuse one event with properties over inventing near-duplicates: `cta_clicked` with
  `{ location, label }`, not `hero_cta_clicked` / `footer_cta_clicked`.
- Loading analytics must not violate the SEO rules above — no render-blocking scripts, no
  client-only content. Keep the PostHog project key in env, never hardcoded.

## Cost tracking (per-run COGS)

Every fix run / PR records what it cost us to produce, so margin is auditable per order:

- **Model(s) used** — which model served each step (e.g. a cheap triage model for file-finding,
  Opus for edits), so spend is attributable per model.
- **Tokens** — input + output token counts (plus the image-gen count for any Tier-C thumbnails).
- **Sandbox time** — wall-clock seconds the E2B microVM was alive.

From these we compute `token_cost_cents` + `sandbox_cost_cents` (+ `image_cost_cents`) on
`fix_runs` and **alert when a run approaches its order price** (margin guard). The raw inputs and
the derived cents live on `fix_runs`; see the data model + unit-economics risk in
[`plan/plan.md`](plan/plan.md).

## Conventions

- TypeScript strict; no `any` escape hatches without a reason. Prefer editing existing files
  over adding new ones; don't add abstractions a task doesn't need.
- Prettier + ESLint are authoritative — run `bun run format` / `bun run lint`.
- The rubric lives in [`RUBRIC.md`](RUBRIC.md) (single source of truth). Keep check
  IDs/categories identical between it, `@repo/checker`, and the agent prompt so the re-check
  can never disagree with what we sold.
- Default to no code comments; only explain non-obvious "why".
- Always choose either geo.repair (our own live website domain for this repo's website folder) or linkrunner.io (Exemplary aeo-optimized website)



PROJECT

## Package organization — shared vs app-local

Decide where code lives by whether it is **shared across apps** or **specific to one app**.

- **Shared / reusable → make a workspace package in `packages/*`.** Anything that more than
  one app could use (or that represents a cross-cutting capability) gets its own
  `@repo/<name>` package: AI/model clients (e.g. OpenRouter), shared types, run flows,
  rubric/checker logic, GitHub/Octokit helpers, db client, etc. Consume it from apps via the
  package name in `dependencies` (`"@repo/<name>": "*"`) and import with `@repo/<name>` (or a
  subpath export like `@repo/<name>/sub`). Do not reach into another app's folder or
  copy-paste shared logic between apps.
  - Examples: `@repo/types`, `@repo/db`, `@repo/secrets`, `@repo/ai` (OpenRouter),
    `@repo/checker`, `@repo/github`, `@repo/agent`.
- **App-specific → keep it inside that app.** Anything only one app needs (a route handler, a
  one-off React component, an app-only dependency) lives in that `apps/*` package and is
  installed there, not promoted to `packages/*`.

Rule of thumb: if you are about to add a dependency or a module that a second app would
plausibly import, create/extend a `@repo/*` package instead of installing it inside one app.
When unsure, prefer a shared package for libraries/SDKs/types/flows, and app-local for UI and
wiring that only makes sense in that app.
