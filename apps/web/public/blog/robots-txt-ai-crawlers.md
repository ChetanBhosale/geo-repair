---
title: "Robots.txt for AI crawlers: allow useful pages and block noise | GEO Repair"
description: "How to keep important pages open to AI crawlers without accidentally exposing private, staging, or low-value surfaces."
source: https://geo.repair/blog/robots-txt-ai-crawlers
---

# Robots.txt for AI crawlers: what to allow and what to avoid

> How to keep important pages open to AI crawlers without accidentally exposing private, staging, or low-value surfaces.

**May 31, 2026** · Crawling, Robots.txt, AI Crawlers · By GEO Repair

Robots.txt is one of the easiest places to lose AI search visibility by accident. A site can have strong content, clean metadata, and valid structured data, then block the crawlers that need to read it.

The goal is not to allow everything. The goal is to allow the public pages you want discovered while keeping private, staging, duplicate, and low-value routes out of reach.

## Which AI crawlers should you think about?

The exact list changes over time, but most AI search readiness checks look for clear treatment of major AI and search user agents such as GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, Googlebot, and Bingbot.

You do not need a complicated rule set for a normal marketing site. You need rules that avoid accidental blocks and point crawlers to the canonical sitemap.

## What should robots.txt include?

A practical public-site robots file usually includes:

- A default rule that allows crawlable public pages
- Explicit allow rules for AI crawler user agents you support
- Disallow rules for private or operational routes
- A sitemap URL

The sitemap line matters because it tells crawlers where the canonical URL inventory lives.

## What should you avoid?

Avoid blanket rules copied from staging environments. The classic failure is:

```txt
User-agent: *
Disallow: /
```

That rule tells every crawler to stay out. It is useful on a private preview. It is harmful on a production marketing site.

Also avoid blocking unfamiliar user agents just because the names look new. If you decide to block a crawler, make it an intentional policy decision, not a forgotten default.

## How do you verify it?

Check the production file directly:

```bash
curl -s https://example.com/robots.txt
```

Confirm the rules match the real production surface. Then compare the sitemap against your public routes. Important pages should be indexable, canonical, and listed.

Robots.txt will not win AI citations on its own. It simply decides whether a crawler is allowed to enter. Get that wrong, and every other optimization can become invisible.

---

_Markdown copy of [Robots.txt for AI crawlers: allow useful pages and block noise | GEO Repair](https://geo.repair/blog/robots-txt-ai-crawlers), a faithful text version of the page for machines and readers. © GEO Repair._
