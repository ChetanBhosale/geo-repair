---
id: freshness-eeat
name: Freshness & E-E-A-T signals
category: Content
pillars: [geo, aeo]
tier: A
fixable: true
scope: per-page
priority: low
---

# freshness-eeat — visible dates, author, about/contact signals

## What it checks & why
Visible dates, author, and about/contact signals raise experience/expertise/authority/trust
signals engines weigh. **Structural surfacing of existing facts only** — never invent dates or
authorship.

## Pass bar
pass = date + author/about signals present where derivable. partial = some present. fail = none on
content that should have them.

## How to fix
Where the date/author already exists in frontmatter / CMS / page data but isn't surfaced, render it
(e.g. a visible published/updated date, a byline) and/or mark it up in existing `Article` JSON-LD.

## Auto-fix vs flag
Only surface/mark up facts that **already exist** in the content source. **Never fabricate** a date,
author, or credential. No derivable date/author → flag, don't guess.

## Verify
Build + type-check pass; surfaced values match the real source; any JSON-LD validates.

## Skip or flag when
Already present → no-op. No real date/author to surface → skip with reason.
