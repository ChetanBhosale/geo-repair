---
id: charset
name: Charset declaration
category: Rendering
pillars: [seo]
tier: A
fixable: true
scope: site-wide
priority: low
---

# charset — <meta charset="utf-8"> early in <head>

## What it checks & why
`<meta charset="utf-8">` declared early in `<head>` (within the first ~1024 bytes) prevents
mojibake across languages. Trivial, deterministic structural fix.

## Pass bar
pass = charset present and early. partial = present but late. fail = missing.

## How to fix
Ensure `<meta charset="utf-8">` is the first child of `<head>`. Modern frameworks emit it by
default — **verify, add only if missing**. Next emits it automatically (act only if a custom
document / `<head>` dropped it); the real fixes land on hand-written **static HTML** and custom
`_document.tsx` / head templates.

## Auto-fix vs flag
No-op on most modern frameworks → detect-then-skip; don't manufacture a diff.

## Verify
Build + type-check pass; charset present early on edited documents.

## Skip or flag when
Framework already emits it → no-op.
