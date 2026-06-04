---
id: hreflang
name: Hreflang (international routing)
category: Metadata
pillars: [seo]
tier: A
fixable: true
scope: per-page
priority: low
---

# hreflang — locale annotations (only when locales already exist)

## What it checks & why
When the site **already serves multiple locales / translated routes**, emit `hreflang`
annotations (+ `x-default`) mapping each page to its language variants so engines serve the right
language.

## Pass bar
pass = reciprocal hreflang + x-default for each variant. partial = incomplete mapping. fail =
missing on a multi-locale site. (not-applicable on single-locale sites.)

## How to fix
**Only when translated routes already exist** (i18n config, `/en` `/fr` segments, locale content
collections): emit reciprocal `hreflang` `<link>`s — or Next's `alternates.languages` in the
Metadata API — for each variant **plus** an `x-default`. Derive the locale map from the existing
routing / i18n config.

## Auto-fix vs flag
**Never invent locales or translations.** Single-locale site, or an ambiguous mapping → skip /
flag, don't fabricate alternates.

## Verify
Build + type-check pass; hreflang links reciprocal and resolve; x-default present.

## Skip or flag when
Single locale → not-applicable. Ambiguous variant mapping → flag.
