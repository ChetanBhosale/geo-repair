---
title: "llms.txt for AI search: publish a clean site map | GEO Repair"
description: "A practical explanation of llms.txt, Markdown twins, and how a curated index can help AI systems find the right pages."
source: https://geo.repair/blog/llms-txt-for-ai-search
---

# What is llms.txt and should your website have one?

> A practical explanation of llms.txt, Markdown twins, and how a curated index can help AI systems find the right pages.

**May 30, 2026** · llms.txt, Markdown, AI Search · By GEO Repair

llms.txt is a plain-text index that points AI systems to the pages and Markdown resources you most want them to read. Think of it as a curated map for machines: what the site is, which pages matter, and where clean text copies live.

It does not replace robots.txt or sitemap.xml. It complements them.

## What problem does llms.txt solve?

A sitemap tells crawlers which URLs exist. Robots.txt tells crawlers what they may fetch. llms.txt gives context: which resources are important, what each resource contains, and where a simpler Markdown version may be available.

That matters because AI systems often work better with clear, low-noise text than with a full visual page that includes navigation, footers, scripts, and layout markup.

## What should an llms.txt file contain?

A practical file should include:

- The site name
- A short description of what the site does
- Links to core pages
- Links to important resources such as blog posts, docs, pricing, security, and policies
- Markdown twin links when available
- Short descriptions for each linked page

Keep it curated. Do not dump every route if many of them are thin, duplicate, private, or unimportant.

## What are Markdown twins?

A Markdown twin is a clean text version of a page served at a predictable URL, often by appending `.md` to the route. For example, a blog post might live at `/blog/example-post`, with its twin at `/blog/example-post.md`.

The twin should be faithful to the real page. Do not publish different claims in Markdown than you show humans in HTML.

## Should every site add llms.txt?

If your site depends on being understood by AI search engines, it is worth adding. The file is cheap, transparent, and easy to audit. It also forces a useful internal discipline: naming the pages you believe are important enough for machines to read.

llms.txt will not force an AI system to cite your site. It can make the best material easier to find, parse, and evaluate, which is exactly the part you control.

---

_Markdown copy of [llms.txt for AI search: publish a clean site map | GEO Repair](https://geo.repair/blog/llms-txt-for-ai-search), a faithful text version of the page for machines and readers. © GEO Repair._
