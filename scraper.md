# scraper.md — Fetching & Scoring (`@repo/checker` data layer)

How the free checkup **fetches** a site, **what** it reads, and how those raw signals become
the **SEO / GEO / AEO / Overall** scores shown to the user.

> Scope: this doc covers the *read* path (fetch → parse → score). The rubric itself (every
> check ID, weight, tier) is canonical in [`RUBRIC.md`](./RUBRIC.md) — this file references it,
> never redefines it. Customer-facing copy says **"AI Search readiness,"** never "GEO/AEO."

> **Honesty guardrail:** we score **technical readiness only** — never "you'll be cited" or a
> traffic promise. A blocked/unreadable fetch is reported as *inconclusive*, never scored as a
> failure off a challenge page.

---

## 1) Best way to fetch

No single fetcher works on every site. Use a **tiered escalation** — cheapest first, escalate
only when the cheaper tier is blocked. Each fetch returns a normalized result so the checker
never cares which tier produced it.

### Fetch tiers

| Tier | Tool | Use for | Cost |
|------|------|---------|------|
| **0 — Static** | `fetch()` / `undici` (real UA + headers) | `robots.txt`, `sitemap.xml`, `llms.txt`, and the **raw no-JS HTML** (needed for the `ssr-visibility` diff) | ~free, fast |
| **1 — Primary (default)** | **Playwright headless** — `headless: 'new'` + **stealth plugin** (`playwright-extra` + `puppeteer-extra-plugin-stealth`) + real UA/viewport/locale | The **rendered DOM** of every page; ~90% of real custom-coded sites; passes most JS challenges | seconds, ~hundreds MB RAM |
| **2 — Unblock fallback** | **Scrapling `StealthyFetcher`** (Python sidecar, called over HTTP) | Sites that Tier 1 reports blocked (Cloudflare Turnstile/interstitial) | slow, heavy — fallback only |
| **3 — Give up honestly** | — | DataDome/Akamai still blocking, or repeated failures | mark `fetch_blocked` → **inconclusive**, ask consenting owner to allowlist our UA |

### Rules

- **Default to Tier 1, not Tier 0.** We need the rendered DOM anyway for the `ssr-visibility`
  check (compare Tier 0 raw HTML vs Tier 1 rendered HTML — if primary content only appears
  after hydration, the site is largely invisible to AI crawlers).
- **Vanilla headless is detectable** (`navigator.webdriver`, `HeadlessChrome` UA) — *always*
  run Tier 1 with new-headless + the stealth plugin, or it gets blocked faster than a plain
  fetch. This is non-negotiable.
- **Never score a challenge page.** After every fetch, run the **block detector** (below). If it
  fires, escalate a tier — do **not** parse a "Just a moment…" page as if it were the site.
- **Stealth only on consented own-site fetches** (the user typed their URL — Tier 1/2 fine). The
  **off-site citation diagnostic** crawls third-party sites we don't control → stay polite,
  best-effort, no aggressive bypass (their ToS), and it's diagnostic-only so a block degrades
  gracefully.
- **Be a good citizen:** respect target `robots.txt`, set fetch timeouts + response size caps,
  concurrency-limit our crawler, per-IP + per-domain rate-limit (Upstash Redis), and **cache per
  domain ~24h**. (Mirrors `plan.md` anti-abuse.)

### Block detector (`fetch_blocked`)

After each fetch, scan status + HTML for: HTTP `403`/`503`/`429`, `cf-mitigated` / `cf-chl` /
Turnstile markers, the strings `"just a moment"`, `"attention required"`, `"enable javascript"`,
`"captcha"`, DataDome/PerimeterX/Akamai fingerprints, or a suspiciously tiny body. → escalate
tier; if the top tier still fails, emit `fetch_blocked` and mark affected checks **inconclusive**.

> Verified in practice: a plain server-side fetch (the maximalstudio approach) **hard-fails on
> G2.com** and returns challenge HTML for other Cloudflare-protected sites. This is why Tier 1 +
> the block detector are mandatory, not optional.

### Crawl surface (which pages)

- **Quick audit** → homepage only.
- **Full audit** → homepage + up to N key pages (default ~5–10) pulled from `sitemap.xml`
  (fall back to a shallow same-origin link crawl if no sitemap). Sitemap **page count also
  drives pricing** — see `RUBRIC.md` → `sitemap`.

---

## 2) What we need to scrape

Per **domain** (fetched once): `robots.txt`, `sitemap.xml` (+ sitemap-index expansion for the
page count), `/llms.txt`, response headers (`X-Robots-Tag`, status, `Content-Type`).

Per **page** (homepage always; key pages in full audit): both the **raw HTML** (Tier 0) and the
**rendered DOM** (Tier 1), then extract:

| Group | What we pull from the DOM/headers | Feeds check(s) |
|-------|-----------------------------------|----------------|
| **Rendering** | raw-vs-rendered content diff, `<!doctype>`, charset, HTTP status | `ssr-visibility`, `doctype`, `charset`, `indexability` |
| **Metadata** | `<title>`, `<meta name=description>`, canonical, `<meta robots>`, favicon, `hreflang` | `meta-tags`, `canonical-urls`, `favicon`, `hreflang`, `indexability` |
| **Social** | `og:*` tags, `twitter:*` tags, referenced OG image (+ its dimensions) | `open-graph`, `social-image-size` |
| **Structured data** | every `<script type="application/ld+json">` block (parsed + type-checked) | `structured-data`, `answerability` (FAQPage), `freshness-eeat` (Article dates/author) |
| **Semantics** | heading tree (`<h1>`…`<h6>`), landmarks (`header/nav/main/footer`), accessibility tree (roles, accessible names on buttons/links/inputs) | `semantic-html`, `interactive-labels` |
| **Content** | visible text (word count, readability), outbound links + targets, internal links + anchor text, visible dates / author / about-contact signals | `internal-linking`, `freshness-eeat`, `citation-quality`, `definitions`, `markdown-twins` |
| **Answerability** | question-shaped headings, FAQ blocks, "X is Y" definition patterns | `answerability`, `definitions` |
| **Crawl surface** | AI-crawler allow/deny rules, sitemap validity, `llms.txt` contents | `robots-ai-crawlers`, `sitemap`, `llms-txt` |

**Advisory, never scored** (collected but excluded from the 0–100): off-site citation placement
(who AI cites for category questions), agentic-readiness signals (CLS/WebMCP), Search Console
verification meta presence. See `RUBRIC.md`.

---

## 3) How we score SEO / GEO / AEO / Overall

One deterministic, **versioned** rubric (`rubric_version` stored on every checkup). Each check
returns `{ id, category, weight, status, evidence, ... }` per the `RUBRIC.md` schema.

### Per-check status → points

- `pass` = **full** weight · `partial` = **half** weight · `fail` = **0** · `inconclusive`
  (blocked/unreadable) = **excluded from the denominator** (don't penalize what we couldn't read).

### Score = weighted percentage

```
score = round( Σ(earned weight) / Σ(applicable weight) × 100 )   // 0–100
```

(Same shape every competitor uses, incl. the maximalstudio API we inspected:
`score = earnedWeight / totalWeight × 100`.) Checks that don't apply to a page (e.g. `hreflang`
with no locales) are dropped from the denominator, not failed.

### The three pillars (which checks roll into which score)

Each pillar is the weighted % over **its** member checks; some checks count toward more than one
pillar (e.g. structured data helps both SEO and GEO). Canonical IDs from `RUBRIC.md`:

| Pillar | What it answers | Member checks (rubric IDs) |
|--------|-----------------|----------------------------|
| **SEO** | Classic search hygiene | `meta-tags`, `canonical-urls`, `open-graph`, `social-image-size`, `favicon`, `hreflang`, `image-alt-text`, `internal-linking`, `semantic-html`, `indexability`, `sitemap`, `mobile-viewport`, `doctype`, `charset` |
| **GEO** (Generative Engine Optimization) | Can AI crawlers **reach + parse** the site | `ssr-visibility` *(critical weight)*, `robots-ai-crawlers`, `llms-txt`, `structured-data`, `semantic-html`, `freshness-eeat`, `markdown-twins`, `interactive-labels` |
| **AEO** (Answer Engine Optimization) | Can an answer engine **extract a direct answer** | `answerability`, `definitions`, `citation-quality`, `structured-data` (FAQPage/HowTo), `freshness-eeat`, `semantic-html` (question-shaped headings) |

> Naming note: customers see **"AI Search readiness"** + plain-language subscores ("Reachable by
> AI", "Answer-ready"). SEO/GEO/AEO are internal pillar names.

### Overall score

```
Overall = round( w_seo·SEO + w_geo·GEO + w_aeo·AEO )    // weights sum to 1
```

Default pillar weights (tune in `@repo/checker` config, store with `rubric_version`): **GEO 0.40
· AEO 0.35 · SEO 0.25** — we lead with AI-search readiness, the product's whole premise. The
`ssr-visibility` check carries the single largest check-weight inside GEO because a CSR-only site
is effectively invisible to AI crawlers regardless of everything else.

### Deterministic vs LLM-assisted

- **~70% of checks are deterministic** — pure presence/validity tests on parsed tags
  (`meta-tags`, `canonical-urls`, `robots-ai-crawlers`, `sitemap`, `structured-data` validity,
  `image-alt-text`, `doctype`, …). No model call, fully reproducible, zero marginal cost.
- **~30% are LLM-assisted** — the quality judgments a regex can't make: `answerability`,
  `definitions`, `citation-quality`, `freshness-eeat`. One bounded model call per page returns
  `pass|partial|fail` + evidence. (This is the part maximalstudio's tool calls its "AEO
  analysis"; when their LLM call fails, their AEO score silently drops out — we instead mark it
  `inconclusive` and say so.)
- **Reproducibility:** deterministic checks must return identical scores on unchanged input.
  LLM-assisted checks use temperature 0 + a fixed prompt pinned to `rubric_version`; if the model
  is unavailable, that check is `inconclusive`, never guessed.

---

## 4) On what basis we give the result

Every number we show is **evidence-backed and explainable** — no black box. For each check the
result carries:

- **`evidence`** — the exact offending file / route / snippet (e.g. "no `<script type=ld+json>`
  on `/`", "title is 14 chars", "`robots.txt` disallows `GPTBot`"). This is also the agent's
  starting clue if they later buy the fix.
- **`status` + `weight`** — why it earned full / half / zero points.
- **`fix_hint`** — plain-language what-to-do (advisory; the agent re-verifies against real code).
- **`tier`** — A (auto-fixable markup) / B (derived content) / C (net-new, opt-in only).

### Honesty rules baked into the result

1. **Readiness, not outcomes.** We report "technical AI-search readiness," never citations or
   traffic. Page type sets a ceiling — transactional pages (product/pricing) rarely get cited
   *no matter how clean the markup*; we never promise citations on them.
2. **Inconclusive ≠ fail.** If a fetch was blocked or a check couldn't run, it's **excluded from
   the denominator** and labeled inconclusive — we never inflate a "fail" off a challenge page or
   a missing model call.
3. **Advisory signals stay out of the number.** Off-site citation placement, agentic-readiness
   (CLS/WebMCP), and Search-Console-verification presence are **shown but never scored** — they're
   non-deterministic or outside our control to fix.
4. **The re-check can't disagree with what we sold.** The post-merge re-check runs the *same*
   `rubric_version`, so the before→after **readiness delta** is apples-to-apples. The displayed
   delta is the proof, not a promise.
5. **Reproducible + versioned.** Same input + same `rubric_version` → same score, always. Every
   checkup stores its `rubric_version`, `subscores`, and `raw_findings` so any score is auditable
   after the fact.

---

## Detecting `markdown-twins` (prior art: dualmark)

The `markdown-twins` check (GEO pillar) is more than "does a `.md` file exist." There's an
emerging open standard for *how* a site serves a markdown twin to AI agents:
[dodopayments/dualmark](https://github.com/dodopayments/dualmark) (AEO infrastructure +
[`AEO Spec`](https://github.com/dodopayments/dualmark/tree/main/spec), Apache-2.0). Their
`@dualmark/cli verify` is a **conformance verifier** for that protocol, and dualmark.dev/play
runs it live. It's worth modeling our `markdown-twins` check on it so our finding lines up with
a real standard rather than an ad-hoc heuristic.

> Scope caution: dualmark's score is **only** the markdown-twin protocol (HTTP headers +
> content negotiation, no DOM/render/LLM). It's a narrow plumbing check, not a content audit, and
> a normal custom-coded site scores ~0 there because `<url>.md` 404s. We keep this as **one
> check** inside our broader rubric, not as our whole model. Their scoring shape is the same
> `earned/total × 100` we already use (§3).

### What a conformant twin looks like (signals to extract)

For a page URL, derive the twin at `<url>.md` (strip query/hash), fetch it with
`Accept: text/markdown`, and also probe the HTML URL's negotiation behavior. Signals, cheapest
first (all are header/status/body checks; no rendering needed):

| Signal | What passes | Tier of conformance |
|--------|-------------|---------------------|
| Twin reachable | `<url>.md` returns 2xx | Basic |
| `Content-Type` | `text/markdown; charset=utf-8` on the twin | Basic |
| `X-Markdown-Tokens` | present, positive integer | Basic |
| `X-Robots-Tag` | contains `noindex` (the twin must not compete with the HTML in search) | Basic |
| `Vary: Accept` | present on the twin (and ideally the HTML) response | Basic / Standard |
| Non-empty body | twin body has content | Basic |
| `Link rel="alternate"` | HTML response advertises the twin via `Link: <…>; rel="alternate"; type="text/markdown"` | Standard |
| Accept negotiation | `Accept: text/markdown` on the **HTML** URL returns markdown | Standard |
| `406` fallback | an `Accept` excluding both html+markdown returns `406 Not Acceptable` | Advanced |
| Bot-UA negotiation | a `GPTBot` User-Agent receives markdown by default | Advanced |
| `X-AEO-Version` | advertises the spec version (e.g. `1.0`) | Advanced |
| `X-Content-Type-Options` | `nosniff` on the twin | Advanced |

dualmark's own weights (max 125): twin-reachable is heaviest (20); the core Basic headers and
`Link rel=alternate` / Accept-negotiation are 10 each; the Advanced niceties are 5. Their
conformance tiers are ratio thresholds: **Basic ≥60%, Standard ≥80%, Advanced ≥95%**.

### How this folds into our scorer

- **Don't import their thresholds as our pillar score.** Inside our rubric, `markdown-twins` is a
  single check returning `pass` / `partial` / `fail` per the `RUBRIC.md` schema — e.g. `pass` =
  twins served with correct content negotiation, `partial` = twins exist but missing headers /
  `Link rel=alternate` / negotiation, `fail` = no twin. Twins are an **enhancement**, so the
  check is low-weight and a `fail` shouldn't tank an otherwise AI-readable site.
- **Deterministic + cheap.** Like dualmark, this is pure header/status/body inspection (no Tier 1
  render, no LLM) — runs in the deterministic bucket (§3).
- **`evidence`** should name the exact gap (e.g. "`/blog/x.md` 404", "twin served but no
  `Vary: Accept`", "HTML missing `Link rel=alternate`") so the fix agent has a precise starting
  clue and the `fix_hint` can point at dualmark's framework adapters (Next/Astro/SvelteKit/
  Cloudflare/Deno) as the implementation path.
- Canonical check ID/weight/tier stay in [`RUBRIC.md`](./RUBRIC.md); the above is the *detection
  recipe*, not a redefinition.

## Pipeline (end to end)

```
URL
 └─> fetch domain files (Tier 0): robots.txt, sitemap.xml (+page count), llms.txt
 └─> for each page (homepage; +key pages in full audit):
       Tier 0 raw HTML  ──┐
       Tier 1 rendered DOM ┤─> block detector ─(blocked)─> Tier 2 Scrapling ─(blocked)─> inconclusive
                           └─> extract signals (§2)
 └─> run @repo/checker:
       deterministic checks  ─┐
       LLM-assisted checks   ─┴─> per-check {status, evidence, weight}
 └─> roll up: SEO%, GEO%, AEO%  ->  Overall (weighted)
 └─> render: Overall + 3 pillars + failing checks (+ evidence) + advisory diagnostics
 └─> persist: checkups{ score, subscores, raw_findings, is_ssr, rubric_version, source }
```

See also: [`RUBRIC.md`](./RUBRIC.md) (canonical checks) · [`plan/plan.md`](./plan/plan.md)
(product flow, pricing, trust, architecture).
