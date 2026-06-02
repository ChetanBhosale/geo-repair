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
- **Semantic, accessible, fast:** one `<h1>` + correct hierarchy, landmarks, alt text,
  descriptive anchors, FAQ/answerability where it fits, WCAG AA, healthy Core Web Vitals.

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
- **Never promise citations or traffic.** We improve *technical readiness* immediately;
  actual outcomes (being cited by ChatGPT/Perplexity/Google AI) take weeks and aren't
  guaranteed. All copy, the re-check, and the refund policy must reflect this.

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
- Loading analytics must not violate the SEO rules above — no render-blocking scripts, no
  client-only content. Keep the PostHog project key in env, never hardcoded.

## Conventions

- TypeScript strict; no `any` escape hatches without a reason. Prefer editing existing files
  over adding new ones; don't add abstractions a task doesn't need.
- Prettier + ESLint are authoritative — run `bun run format` / `bun run lint`.
- The rubric lives in [`RUBRIC.md`](RUBRIC.md) (single source of truth). Keep check
  IDs/categories identical between it, `@repo/checker`, and the agent prompt so the re-check
  can never disagree with what we sold.
- Default to no code comments; only explain non-obvious "why".
