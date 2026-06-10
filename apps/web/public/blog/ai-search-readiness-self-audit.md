---
title: "AI-search readiness self-audit: 7 manual checks | GEO Repair"
description: "Seven checks you can run by hand, in a terminal and a browser, to see whether ChatGPT, Perplexity, and Google AI can fetch, parse, and trust your pages."
source: https://geo.repair/blog/ai-search-readiness-self-audit
---

# The 7-minute AI-search readiness self-audit

> Seven checks you can run by hand, in a terminal and a browser, to see whether ChatGPT, Perplexity, and Google AI can fetch, parse, and trust your pages.

**June 9, 2026** · AI Search, Audit, Technical · By GEO Repair

Before you buy any GEO or AEO tool, you can check most of your site's AI-search readiness by hand in about seven minutes. AI search engines like ChatGPT, Perplexity, and Google AI Overviews do not see your site the way your browser does. They fetch raw HTML, parse its structure, and decide whether a page is clean enough to quote.

None of the checks below guarantees a citation. They remove the avoidable reasons a page gets skipped. You will need a terminal and a browser tab.

## 1. Can a crawler actually see your content?

The most damaging failure is content that only appears after JavaScript runs. Many AI crawlers fetch HTML and execute little or no JavaScript, so a client-rendered page can look like an empty shell to them.

```bash
curl -s https://yoursite.com | grep -i "a sentence from your main content"
```

If your headline and body text are missing from that raw HTML, crawlers are probably missing them too. Server-render or pre-render the pages you want quoted.

## 2. Does your robots file allow AI crawlers?

```bash
curl -s https://yoursite.com/robots.txt
```

Check that you are not accidentally blocking the user-agents AI engines actually use:

```
GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, anthropic-ai,
PerplexityBot, Google-Extended, CCBot
```

A blanket `Disallow: /` or a single blocked AI user-agent quietly removes you from AI answers. Keep your intentional disallows, but make sure real content is reachable.

## 3. Is there a sitemap and an llms.txt?

```bash
curl -s https://yoursite.com/sitemap.xml | head
curl -s https://yoursite.com/llms.txt | head
```

Your sitemap should list real, canonical pages and be referenced from `robots.txt`. An `llms.txt` file is a plain-Markdown index of your most important pages. It is cheap to add and easy for answer engines to read.

## 4. Do your title, description, H1, and first sentence agree?

Open a key page and compare four things: the `title` tag, the meta description, the `h1`, and the opening sentence. If they describe four different things, a model cannot tell what the page is about. Each should point at the same intent, and the first sentence should answer the question the page is meant to answer.

## 5. Is your structured data valid, and does it match the page?

Paste a URL into a schema validator such as Google's Rich Results Test. You want `Organization` and `WebSite` site-wide, `Article` on posts, and `BreadcrumbList` on nested pages, all describing content that actually exists on the page. Invalid or fictional structured data is worse than none.

## 6. Is the content answer-first?

Studies of what AI engines quote consistently point to two things: direct answerability and plain definitions. Put the answer in the first sentence of a section ("X is Y"), then add nuance below it. Question-shaped headings and a genuine FAQ block help a model match your page to a query.

## 7. Do you cite trusted sources?

Pages that link out to primary data, research, standards bodies, and `.gov` or `.edu` sources tend to be quoted more often than pages that assert facts with no sources. Wherever your copy already references a fact, wire up the real outbound link.

## What to fix first

Order the work by leverage. Rendering (#1) and crawl access (#2) come first because they gate everything else. Then structure and metadata (#3 to #5). Then the content signals (#6 and #7) that make a clean page worth quoting.

Running these checks by hand on one page takes a few minutes. Running all 23 of them across every page in your sitemap is what our [free checkup](/#checkup) does automatically: a 0 to 100 readiness score with evidence and a fix hint for each issue, no signup or card. If you want the fixes shipped, the agent opens a pull request you review and merge. Either way the goal is the same: be a clean, sourceable page when an AI system needs one.

---

_Markdown copy of [AI-search readiness self-audit: 7 manual checks | GEO Repair](https://geo.repair/blog/ai-search-readiness-self-audit), a faithful text version of the page for machines and readers. © GEO Repair._
