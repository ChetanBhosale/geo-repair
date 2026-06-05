---
title: "Free GEO and AEO audit with scan report"
description: "Run a free GEO and AEO audit for answer engine optimization and generative engine optimization. Get a scan report, checkup score, and fix plan."
source: https://geo.repair/geo-aeo-checker
---

# Free GEO and AEO audit for AI citation and visibility.

Paste a URL to run a free AEO scan and GEO scan. We score answer engine optimization and generative engine optimization across 23 checks for ChatGPT, Perplexity, and Google AI Overviews. You see what's blocking the site, then ship the fix in a pull request.

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

### What is a GEO and AEO checker?

A GEO and AEO checker audits how ready a website is for generative engine optimization (GEO) and answer engine optimization (AEO). It checks how easily AI engines like ChatGPT and Perplexity can read, understand, and cite the site. GEO Repair runs 23 checks and returns a 0 to 100 report with the exact issues to fix.

### How does the AI citation checker work?

The AI citation checker fetches your page the way an AI crawler would, then grades the on-site signals that correlate with being quoted: server-rendered content, structured data, answer-first definitions, citations to trusted sources, and a clean crawl surface. It reports which signals pass, which are partial, and which fail.

### What's the difference between GEO and AEO?

GEO (generative engine optimization) is the broad practice of optimizing a site to be used by generative AI engines. AEO (answer engine optimization) is the subset focused on answerability: question-shaped headings, FAQ markup, and answer-first writing so an engine can lift a direct answer. Our checker scores both.

### Is this a free AEO audit and GEO scan?

Yes. The AEO audit, AEO scan, GEO scan, and checkup report are free. No signup is needed. You get the full 23-check breakdown with an overall AI search readiness score. Paid plans add the agent that opens fix pull requests for you.

### Do you store or train on my code?

No. We clone the one repository you pick into an ephemeral sandbox, make the fixes, open a pull request, and destroy the sandbox. Your code is never retained and is never used to train models. Zero data retention, no model training.

### Will a high score guarantee AI citations?

No. The checker measures technical readiness, not outcomes. A high score removes the on-site blockers to citation, but whether an engine actually cites you also depends on your topic, authority, and content type. We never promise rankings or citations, only that your readiness improved.

---

_Markdown copy of [Free GEO and AEO audit with scan report](https://geo.repair/geo-aeo-checker), a faithful text version of the page for machines and readers. © GEO Repair._
