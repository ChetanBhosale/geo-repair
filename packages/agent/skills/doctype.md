---
id: doctype
name: HTML5 doctype
category: Rendering
pillars: [seo]
tier: A
fixable: true
scope: site-wide
priority: low
---

# doctype — <!DOCTYPE html>

## What it checks & why
An HTML5 `<!DOCTYPE html>` makes the browser render in standards mode (not quirks mode).
Document-level structural fix; never touches content.

## Pass bar
pass = doctype present. fail = missing (quirks mode).

## How to fix
Ensure the served document starts with `<!DOCTYPE html>`. Framework-rendered pages have it by
default; **static HTML** is where it's usually missing → prepend it. Document-level only.

## Auto-fix vs flag
No-ops on most modern frameworks → detect-then-skip.

## Verify
Build + type-check pass (or HTML validation for static); doctype present on edited documents.

## Skip or flag when
Already present → no-op.
