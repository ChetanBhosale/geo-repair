---
title: "AI search checklist: fix crawl, schema, and answers | GEO Repair"
description: "A practical checklist for making a site easier for ChatGPT, Perplexity, and Google AI Overviews to fetch, parse, and trust."
source: https://geo.repair/blog/ai-search-optimization-checklist
---

# AI search optimization checklist for technical teams

> A practical checklist for making a site easier for ChatGPT, Perplexity, and Google AI Overviews to fetch, parse, and trust.

**June 3, 2026** · AI Search, Checklist, Technical · By GEO Repair

AI Search Optimization works best when it is treated like an engineering checklist, not a content slogan. The goal is to make sure an AI search engine can fetch the page, identify what it is about, trust the basic facts, and extract an answer without guessing.

This checklist is the minimum technical surface every important page should pass before you spend more time writing new content.

## What should you check first?

Start with the HTML response. Fetch the page the way a non-rendering crawler would:

```bash
curl -s https://example.com | head
```

Then search that output for the headline, the main answer, and the core body copy. If the important content is missing, fix rendering before anything else. AI systems cannot rely on text that only appears after client-side JavaScript runs.

## The core readiness checks

Use this order:

1. Server-rendered content: the headline, body copy, FAQs, pricing facts, and product claims are present in the initial HTML.
2. Metadata: the title, description, canonical URL, Open Graph tags, and Twitter tags match the page's real purpose.
3. Structured data: the page emits valid JSON-LD for the right type, such as Article, Product, FAQPage, Organization, WebSite, or BreadcrumbList.
4. Crawl files: robots.txt allows the crawlers you care about, sitemap.xml lists the canonical URLs, and llms.txt points machines to the best resources.
5. Semantic HTML: the page has one h1, ordered headings, landmarks, descriptive links, and meaningful alt text.
6. Answerability: question-shaped sections contain direct answers before explanation.
7. Trust signals: author, date, policy, pricing, and support details are clear where they matter.

## What usually breaks?

The most common issue is a page that looks complete in the browser but is nearly empty in raw HTML. The second is metadata that was copied from a template and never updated. The third is JSON-LD that exists, but does not describe the actual page.

Those issues are fixable. They usually do not require a full redesign. They require comparing what humans see with what crawlers fetch, then making the source of truth visible in the page response.

## What should you avoid?

Do not promise AI citations. A readiness checklist can remove technical blockers, but it cannot control whether ChatGPT, Perplexity, or Google chooses to cite you. Keep the work honest: make the page readable, structured, and trustworthy, then measure the result.

That is the practical path. Fix the fetch, clarify the page, expose the facts, and stop making machines infer what your website should have stated directly.

---

_Markdown copy of [AI search checklist: fix crawl, schema, and answers | GEO Repair](https://geo.repair/blog/ai-search-optimization-checklist), a faithful text version of the page for machines and readers. © GEO Repair._
