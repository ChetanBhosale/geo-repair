---
title: "GEO Repair · AI Search Optimization for ChatGPT & Perplexity"
description: "Run a free AI search audit that scores how ready your site is for ChatGPT, Perplexity, and Google AI Overviews, then ships a pull request that fixes it."
source: https://geo.repair/
---

# Find your AI search issues, then raise a PR that fixes them, in minutes.

Run a free AEO and GEO scan for ChatGPT, Perplexity, and Google AI Overviews. You get an audit report with the evidence behind each issue.

## From invisible to cited in three steps

Start with a checkup, read the diagnosis, and review the pull request when the fix is ready.

### 01 · Run the free checkup

Paste your URL. We fetch your site the way an AI crawler does and score it across 23 checks in 7 categories: rendering, structured data, metadata, crawl surface, semantics, content, and answerability.

### 02 · See exactly what's broken

Get a 0 to 100 readiness score with per-category subscores and the precise evidence behind every check (the offending route, tag, or missing markup), plus what the agent can fix automatically.

### 03 · Merge the fix PR

The agent clones the one repo you pick into an ephemeral sandbox, applies the structural and content fixes, verifies the build and types, and opens a pull request. You review and merge, and nothing ships without you.

## 23 checks, grouped into 7 categories

One transparent, versioned rubric powers the free checkup, the agent's fix targets, and the post-merge re-check, so the score you're sold is the score we re-measure.

- **Rendering** (3 checks): Is your content in the HTML before JavaScript runs? AI crawlers read the raw response, so server-rendered content, a valid doctype, and a declared charset decide whether they see anything at all.
- **Structured data** (1 check): Valid JSON-LD (Organization and WebSite site-wide, Article and BreadcrumbList where they belong) so engines know what each page actually is.
- **Metadata** (6 checks): Titles and descriptions sized for the SERP, self-referential canonicals, complete Open Graph and Twitter cards, favicons, and a social image that unfurls.
- **Crawl surface** (4 checks): A robots.txt that welcomes GPTBot, ClaudeBot, and PerplexityBot, a valid sitemap, an /llms.txt index, and pages that stay eligible to index.
- **Semantics** (3 checks): One H1, a clean heading hierarchy, page landmarks, accurate alt text, and an accessible name on every control: the machine-eye view of your page.
- **Content** (4 checks): Descriptive internal links, visible dates and authorship, citations to trusted sources, and a clean Markdown twin of every page: the signals that correlate with getting quoted.
- **Answerability** (2 checks): Question-shaped headings, answer-first writing, and defined terms an AI engine can lift straight into a response.

## A score, then the receipts

Every check returns a status, the evidence behind it (the offending route, tag, or missing markup), and whether the agent can fix it. No black box.

- 0 to 100 overall score with per-category subscores
- Pass, partial, or fail on all 23 checks
- Reproducible: the same input always scores the same

## Fixes arrive as a pull request

The agent only touches the checks it flagged, verifies the build and types in a sandbox, and opens a PR you review. Structural and faithful-reformat fixes ship automatically; net-new content stays gated behind your approval.

- Bounded to flagged checks, never free-roams your repo
- Build and type-checked before the PR opens
- You review and merge, nothing ships without you

## Security & trust

The free checkup runs on your public pages. The fix agent runs on one repo, in a sandbox, then disappears.

- **Your code is never kept.** We clone your repository into an ephemeral sandbox, make the fixes, open the pull request, and destroy the sandbox. Nothing persists after the run.
- **Only the one repo you pick is touched.** Least-privilege by design. We request access to a single repository, the one you choose, and never the rest of your account or organization.
- **No confidential data leaves to third parties.** Your source stays inside the run. We don't sell it, share it, or pass it to third-party services beyond what's needed to open your pull request.
- **Zero data retention, no model training.** Your code is never used to train models and is not retained after the sandbox is destroyed. Readiness is measured, the fix is shipped, and nothing is stored.

## Frequently asked questions

### What is AI Search Optimization?

AI Search Optimization is the practice of making a website easy for AI answer engines like ChatGPT, Perplexity, Claude, and Google AI Overviews to read, understand, and cite. It extends traditional SEO with server-rendered content, structured data, an llms.txt index, and answer-first writing so engines can quote you accurately.

### How is this different from traditional SEO?

Traditional SEO optimizes for ranking blue links; AI Search Optimization optimizes for being read and cited inside an AI answer. The two overlap on fundamentals like clean HTML and metadata, but AI engines also reward structure they can parse, explicit definitions, and content they can lift directly into a response.

### Is the checkup really free?

Yes. The free AEO and GEO scan needs no signup. It returns an AI search checkup report across all 23 checks and shows what an AI engine sees. You only pay if you want the agent to open fix pull requests for you.

### Do you store or train on my code?

No. We clone the one repository you pick into an ephemeral sandbox, make the fixes, open a pull request, and destroy the sandbox. Your code is never retained and is never used to train models. Zero data retention, no model training.

### Which AI engines does this help with?

The same fundamentals improve readiness across ChatGPT, Perplexity, Claude, Microsoft Copilot, and Google AI Overviews, because they all crawl the raw HTML, parse structured data, and prefer answer-first content. We optimize the signals every major engine shares rather than gaming any single one.

### Can you guarantee my site will get cited by AI?

No, and anyone who promises that is misleading you. We measure and improve technical readiness, the on-site signals that make citation possible. Whether an engine cites you also depends on your content's topic and authority, which is why we're honest that educational pages get quoted far more often than transactional ones.

---

_Markdown copy of [GEO Repair · AI Search Optimization for ChatGPT & Perplexity](https://geo.repair/), a faithful text version of the page for machines and readers. © GEO Repair._
