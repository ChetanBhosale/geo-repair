---
id: interactive-labels
name: Interactive element labels
category: Semantics
pillars: [geo]
tier: A
fixable: true
scope: per-page
priority: low
---

# interactive-labels — accessible names on interactive elements

## What it checks & why
Every interactive element (button, link, input, select) needs a programmatic accessible name, and
no focusable control should be hidden from the accessibility tree. The a11y tree is the
"machine-eye view" AI agents use to operate a page, and accessible names are a WCAG requirement —
a dual SEO + agentic win.

## Pass bar
pass = all interactive elements named + none wrongly `aria-hidden`. partial = some unnamed.
fail = widespread unnamed/hidden controls.

## How to fix
- Icon-only `<button>`s → `aria-label` (from the icon's purpose or adjacent text).
- Inputs → an associated `<label>` or `aria-label`.
- Icon/image-only links → `aria-label` (or `alt` on the inner image).
- Remove `aria-hidden` from focusable controls; never hide an interactive element from the a11y tree.

## Auto-fix vs flag
**Add attributes only** — never alter visible text, layout, or behavior. Ambiguous control purpose
→ flag for manual review rather than guess a label.

## Verify
Build + type-check pass; edited controls have accessible names; no visible/behavioral change.

## Skip or flag when
All controls already named → no-op. Purpose unclear → flag.
