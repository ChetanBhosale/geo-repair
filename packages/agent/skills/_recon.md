---
id: _recon
name: Recon & framework detection
shared: true
---

# Recon & framework detection

Run **once**, before editing any check. Output: the framework, the site package, the
build/type-check/package-manager commands, and where content actually lives.

## Detect the framework (signals, not file extensions — first match wins)

- `package.json` present → read `dependencies` / `devDependencies` / `scripts`:
  - `next` → **Next.js**. Router: `app/` (or `src/app/`) with `layout.*` → **App Router**;
    `pages/` (or `src/pages/`) → **Pages Router**; both present → hybrid, handle each route
    by its directory.
  - `astro` / `astro.config.*` → **Astro**.
  - `@remix-run/*` / `remix.config.js` → **Remix**.
  - `@sveltejs/kit` / `svelte.config.js` → **SvelteKit**.
  - `vite` + root `index.html`, no SSR framework → **Vite SPA**.
  - React/bundler only → generic SPA — treat like Vite SPA and **flag** SSR-dependent checks.
- No `package.json` but `*.html` files → **static HTML**.
- Monorepo (workspaces) → locate the **site** package, not the repo root.

## Note secondary signals

- `tsconfig.json` (gates type-check), `src/` vs root layout, existing `public/` / `static/`,
  existing `robots.txt` / `sitemap.xml` / `llms.txt`.
- The **content source** — MDX / content-collections vs CMS vs hardcoded — it determines where
  alt text, headings, metadata, and FAQ content actually live.

## Resolve commands (record before editing)

- **Build:** prefer `scripts.build`; else framework default (`next build`, `astro build`,
  `vite build`, `remix vite:build`). Static HTML → no build; run an HTML/JSON-LD validation pass
  on edited files instead.
- **Type-check:** prefer `scripts.check-types` / `typecheck` / `tsc`; else `tsc --noEmit` when
  `tsconfig.json` exists (`astro check` / `svelte-check` where applicable). **No `tsconfig.json`
  → skip type-check and log the skip.**
- **Package manager** from lockfile: `bun.lock` → bun, `pnpm-lock.yaml` → pnpm,
  `yarn.lock` → yarn, `package-lock.json` → npm.

## Shared editing rule

Site-wide tags → the shared layout/head component; page-specific tags → per-route metadata.
Always **read the existing head/metadata before adding**, to avoid duplicates. Prefer the most
localized correct change, and extend existing config rather than adding a parallel one.
