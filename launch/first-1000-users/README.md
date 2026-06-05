# First 1000 Users Launch Pack

This folder contains the first assets to support founder-led acquisition while
the product, dashboard, payments, sandbox, and GitHub fix flow are being built.

The launch target is **1000 free AI Search Readiness checkups**, not 1000 paid
customers. The first paid wedge is agencies and technical marketers who manage
multiple client websites and need a credible client-facing report plus a real
fix path.

## Assets in this pack

- `sample-ai-search-readiness-report.html`
  - A polished, print-ready sample report for sales calls, lead magnets, and
    agency partner demos.
  - Built around the honest promise: technical readiness, not guaranteed
    citations or traffic.
- `agency-one-pager.html`
  - A one-page partner pitch for SEO agencies, content agencies, Webflow/Next.js
    studios, and technical marketing teams.
  - Designed as a leave-behind or PDF attachment after a call.

## Week 2 operating stack

Use **Clay for prospecting and enrichment, not as the CRM**.

Recommended stack for the first 200 to 500 leads:

1. **Clay** for list building, enrichment, website-type research, and account
   scoring.
2. **HubSpot Free** as the CRM and relationship system of record.
3. **Google Workspace Gmail** for the first 100 to 200 hand-personalized emails.
4. **Resend** for waitlist and transactional product emails.
5. **PostHog** for funnel events from checkup to report download to paid fix.

Clay is a good fit when the job is: find agencies, identify their niche, enrich
contacts, summarize their client base, detect website stacks, and score whether
they are worth manual outreach. It is not where the sales pipeline should live.

### CRM choice

Chosen CRM: **HubSpot**.

This is a good default for GEO Repair because HubSpot can own both sides of the
early funnel:

- **Inbound:** waitlist leads, report-download leads, forms, and email history.
- **Outbound:** agency prospects, founder emails, follow-up tasks, and deal
  stages.
- **Upgrade path:** start free, then add Sales Hub Starter only when the manual
  follow-up volume starts to break.

Use **Clay + HubSpot**:

- Clay builds the signal.
- HubSpot stores the relationship, lifecycle stage, owner, notes, tasks, and
  next action.
- Only push prospects from Clay to HubSpot once they score high enough or show
  intent. Do not clutter HubSpot with every scraped company.

Pipedrive remains a reasonable fallback if the work becomes pure deal tracking,
but HubSpot is better now because inbound report leads and outbound agency
prospects should live in the same place.

### Clay workflow for Week 2

Build one Clay table called `Agency Partner Prospects`.

Columns:

- Agency name
- Website
- Country
- Primary niche
- Services offered
- Visible client count
- Has SEO service page
- Has AI search / AI visibility service page
- Builds custom-coded sites
- Likely stack: Next.js, React, Astro, Webflow, WordPress, Framer, Shopify
- Founder / owner name
- Founder LinkedIn
- Founder email
- Technical contact name
- Technical contact email
- Personalization note
- Recommended angle
- Score
- CRM status

Scoring:

- 3 points: sells SEO, content, or technical marketing
- 3 points: serves SaaS, B2B, startups, or ecommerce clients
- 2 points: has visible custom-coded client sites
- 2 points: founder posts about AI, SEO, content, analytics, or web performance
- 1 point: has case studies with client names
- -3 points: only WordPress/plugin implementation
- -3 points: no clear owner or contact path

Outreach rule:

- Score 7 or higher: send personalized founder email.
- Score 5 to 6: connect on LinkedIn and save for later.
- Score below 5: skip.

### Week 2 daily agenda

Day 1:

- Set up Clay table.
- Set up HubSpot Free.
- Create CRM stages: `New`, `Researched`, `Contacted`, `Replied`,
  `Report Sent`, `Pilot Agreed`, `Passed`, `Partner`.
- Create HubSpot properties: `Lead Source`, `Website Type`, `Agency Fit Score`,
  `Recommended Angle`, `Report Sent`, `Client Sites Count`, and
  `Clay Table URL`.
- Add the first 50 agency prospects manually or from search exports.

Day 2:

- Enrich and score the first 50.
- Write one custom first line for the top 20.
- Send 10 to 15 hand-personalized emails from the founder inbox.

Day 3:

- Add 50 more agencies.
- Send 10 to 15 more emails.
- Publish one LinkedIn teardown post.

Day 4:

- Follow up with non-repliers from Day 2.
- Send 10 to 15 new emails.
- Offer the sample report to anyone who replies with interest.

Day 5:

- Review replies.
- Book 3 to 5 calls.
- Convert the best calls into concierge checkups.
- Update messaging based on the exact objections heard.

## Source snapshot for tool choices

Checked on 2026-06-04:

- Clay pricing describes a free plan with limited rows/actions and paid Launch /
  Growth plans for larger prospecting workflows:
  https://www.clay.com/pricing
- HubSpot offers free sales tools and Sales Hub Starter:
  https://www.hubspot.com/products/sales-software-for-beginners
- Pipedrive is a strong simple sales pipeline option with per-seat paid plans:
  https://www.pipedrive.com/en/pricing
- Google sender guidance requires SPF or DKIM, TLS, low spam rates, and gradual
  sending volume:
  https://support.google.com/a/answer/81126
- The FTC CAN-SPAM guide covers commercial email requirements:
  https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
