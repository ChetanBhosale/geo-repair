# AI Visibility

## Product Name

- Sidebar label: `AI Visibility`
- One-off report name: `AI Visibility Snapshot`
- Recurring monitor name: `Visibility Monitor`

## Goal

AI Visibility should show where a customer's site appears in sampled AI-search
answers, where it is cited, and which competitors appear instead. The product
should connect reporting to repair: GEO Repair is not trying to become a generic
AI visibility dashboard. It should show the visibility gap, then map that gap to
technical and content fixes the agent can ship as a PR.

## Current State

The dashboard has a coming-soon page at `/dashboard/ai-visibility`.

The only live behavior is interest capture:

- Authenticated users can click `Show interest`.
- The backend stores one row in `feature_interests` with feature
  `AI_VISIBILITY`.
- No prompt monitoring, AI platform calls, scheduled jobs, reports, or scoring
  logic exists yet.

## Intended User Flow

1. User opens `AI Visibility` from the dashboard sidebar.
2. User sees what the feature will measure and the sample-based accuracy caveat.
3. User clicks `Show interest`.
4. Future versions should let the user define or accept a prompt set.
5. GEO Repair runs those prompts on a schedule or as a one-off snapshot.
6. The report shows brand mentions, cited URLs, competitor mentions, and gaps.
7. The fix workflow maps those gaps to concrete site repairs.
8. After a fix PR is merged, the same prompt set can be rerun for before/after
   proof.

## Intended Metrics

- `prompt_count`: number of monitored prompts in the sample.
- `brand_mention_count`: prompts where the brand appears in the answer text.
- `domain_citation_count`: prompts where the customer's domain is cited.
- `cited_urls`: specific customer URLs cited by AI platforms.
- `competitor_mentions`: competitors mentioned for the same prompts.
- `share_of_sample`: appearances divided by monitored prompts.
- `sentiment`: directional positive, neutral, or negative framing.

## Honesty Guardrails

- Never claim total ChatGPT impressions, total platform-wide citation volume, or
  guaranteed citations.
- Phrase results as sample-based, for example: `Appeared in 6 of 40 monitored
  prompts`.
- Store the prompt, platform, timestamp, answer snapshot, citations, and parser
  version so reports are auditable.
- Make platform coverage explicit. ChatGPT, Perplexity, Gemini, Claude, and
  Google AI Overviews do not behave the same way.
- Keep public copy in plain `AI Search Optimization` language. Use GEO/AEO only
  in internal docs, rubric code, and agent-facing instructions.

## Future Architecture

- Data capture belongs in the job plane, not in a Next route.
- Scheduled or one-off runs should be Temporal workflows.
- Prompt execution should use bounded concurrency and per-run cost tracking.
- Citation parsing should distinguish text-only brand mentions from linked
  source citations.
- Reports should preserve raw answer snapshots for auditability.
- PostHog should track meaningful dashboard interactions once the monitor is
  interactive.

## Non-goals

- Do not build a Semrush or Ahrefs clone.
- Do not scrape or simulate every possible AI query.
- Do not optimize for vanity counts without repair recommendations.
- Do not promise traffic, rankings, or AI citations.

## Open Questions

- Is prompt generation automatic from the scan category, user-entered, or both?
- Should the first paid version be per-project, per-domain, or account-wide?
- Which platforms are worth supporting first based on cost and reliability?
- Should snapshots run before checkout, after checkout, or only after the first
  fix PR?
