## Marketing image fallbacks

Done:

- Baked halftone fallback assets for the indexed homepage feature panels so crawlers see the stylized graphics, while real users still get the live shader overlay.

## Local Mac services

Done:

- Added a user-level macOS Quick Action, `Rewrite for geo.repair`, for selected text in any app. It calls Vertex Gemini using the shared local credential environment from `vertex-image-gen`, rewrites the selected Twitter/LinkedIn-style post into a geo.repair variant, and copies the output to the clipboard.
- Added a second user-level macOS Quick Action, `Generate thoughtful reply`, for selected social posts. It calls Vertex Gemini through the same local credentials, writes `generating...` while it runs, runs a humanizer-style pass for everyday verbal language / humor / mild sarcasm / disappointment when appropriate, and copies a non-promotional reply to the clipboard without mentioning geo.repair unless the selected post is directly related.

there is cdn that provides old cache after deployment too

## V1 pricing and Dodo payment gate

Done:

- Kept the v1 page-count pricing shape: Free Checkup, Starter $49 up to 25 pages, Growth $149 up to 100 pages, Scale $399 up to 250 pages, Enterprise custom contact-only.
- Restored Prisma billing models for `Plan`, `Order`, and `PaymentWebhookEvent`, with `Order` linked to the current `Project`, latest `Scraping`, and `AgentRun`.
- Added backend-v2 billing routes: `GET /api/billing/plans`, `POST /api/billing/fix-checkout`, `GET /api/billing/history`, `GET /api/billing/orders/:id`, `POST /api/billing/orders/:id/reconcile`, and raw-body `POST /api/webhooks/dodo`.
- Gated agent planning and fixing behind a paid matching order. Refunds and disputes cancel active agent runs best-effort.
- Dashboard project page now creates checkout from a completed scan before starting the agent. Checkout return sends users to `/dashboard/purchase?order_id=...`.

Pending:

- Run the billing migration and Prisma generate in the deploy environment.
- Confirm Dodo live product IDs match the same one-time products for Starter, Growth, and Scale.
- Smoke test a test-mode checkout, Dodo return reconciliation, and webhook delivery before public launch.

## AI Visibility placeholder

Done:

- Added the `AI Visibility` dashboard sidebar tab and `/dashboard/ai-visibility` coming-soon page.
- Added authenticated interest capture through `feature_interests` with the `AI_VISIBILITY` feature key.
- Documented the future product goal, sample-based reporting guardrails, and intended architecture in `docs/ai-visibility.md`.

Pending:

- Run the feature-interest DB migration in the deploy environment.
- Replace the interest CTA with the first real snapshot workflow when prompt monitoring starts.

## Scan run (backend-v2 + dashboard-v2)

Done:

- API scan (`POST /api/projects/:id/scan`) always enqueues the Temporal `scrapeWorkflow`; CLI (`bun run scraper`) still runs inline, no queue.
- Worker activity persists logs + result + status via `persist.ts` (shared with the inline/CLI path).
- Completed scans now extract site identity from homepage icons and JSON-LD: brand name, favicon URL, and logo URL. Project scans persist those URLs on `Project`; free scans return them in the scan result.
- Endpoints: `GET /api/projects/:id/scrapings` (history), `GET /api/scrapings/:id/reconcile` (sync DB with Temporal), `GET /api/worker-status?projectId=` (active QUEUED/RUNNING).
- Dashboard project list/detail now use the discovered favicon when available, with the globe fallback preserved.
- Web free-scan and `/report` surfaces now show the scanned site's favicon for personalization.
- Dashboard project detail rebuilt (Vercel-style): run-history dropdown, status/score/pages/started meta grid, category strip, collapsible activity logs + checks + recommendations.
- `useWorkerStatus` hook + `LiveActivity` panel (per-project now, reusable globally).

Pending:

- Run the DB migration for `Scraping` / `Log` / `WorkerStatus` / `Project.websiteError` / project brand identity fields (owner runs migrations).
- LLM-assisted heuristic checks not wired yet.

## Worker status reconcile flow (done)

- API 1: `GET /api/worker-status?projectId=` lists active QUEUED/RUNNING workers (DB-first).
- API 2: `GET /api/worker-status/:workflowId` syncs that workflow with Temporal (`describe()`/`result()`), updates Scraping + WorkerStatus, returns the refreshed item. Errors written to `logs`.
- DB is the source of truth; Temporal is the reconcile fallback only.
- Frontend `WorkerStatusProvider` + `useWorkerStatus(projectId?)` context (`context/worker-status.tsx`): polls API 1 every 2s, runs API 2 for each active workflow id, invalidates scraping/project views when a run goes terminal.
- `<LiveActivity />` (per-project on detail page, global on projects list) consumes the context.

## Agent plan run (backend-v2) — route 1 of 2

Done:

- Schema restructured: `AgentRun` (1:1) -> `AgentPlan` (the single plan container) -> `AgentPlanCheck[]` (one per rubric check). Exactly one `Log` (event `plan_proposed`) links to the plan via `agentPlanId` and is the interactive plan card the user answers + submits. Added `AgentPlanStatus` enum (DRAFTING / AWAITING_USER / SUBMITTED / FAILED).
- New Temporal queue `agent-plan` (+ `agent-plan-worker`), registered in `temporal/worker/index.ts`.
- Planning workflow `agentPlanWorkflow`: each failing check is its own activity (`planCheckActivity`, parallel), then `persistPlanActivity` writes the `AgentPlanCheck` rows + the single plan log and flips plan->AWAITING_USER, run->AWAITING_INPUT. `failPlanActivity` on error.
- Per-check planner (`agent-plan/planner.ts`) is deterministic for now (AUTO vs NEEDS_INPUT vs MANUAL from scan status + `fixableByAgent`/`tier`/`recommendedAction`); body is the seam for an LLM/sandbox planner later.
- Route `POST /api/projects/:id/agent-plan` -> `startAgentPlan`: takes the project's LATEST completed scan, creates `AgentRun` + `AgentPlan` + `AGENT` `WorkerStatus`, enqueues the workflow (workflowId `agent-plan-<runId>`), returns ids (202).
- Updated `@repo/agent` prompts: `planner.md` emits a per-check `plans[]` aligned to `AgentPlanCheck`; `harness.md` aims each check at a full pass with GEO/AEO/SEO best-practice bar.

Pending:

- Run the DB migration for the agent tables (owner runs migrations). `prisma generate` already run locally.
- Route 2: user answers each `AgentPlanCheck` (choice/selectedOption/userSuggestion) + Submit -> start the fix run (sandbox + harness + PR).
- Worker-status reconcile for AGENT runs (mirror the scraping reconcile).
- Swap the deterministic per-check planner for the LLM/sandbox planner (`prompts/planner.md`).

## Agent UI + read APIs (dashboard-v2 + backend-v2)

Done:

- Shared types `@repo/types/agent` (AgentRunSummary/Detail, AgentPlanDTO, AgentPlanCheckDTO, AgentChatLog, responses).
- Backend reads: `GET /api/projects/:id/agent-runs` (list) + `GET /api/agent-runs/:id` (run + plan + checks + chat logs). `startAgentPlan` now returns the typed `StartAgentPlanResponse`.
- Frontend data layer: endpoints + `lib/api` (startAgentPlan/getProjectAgentRuns/getAgentRun), `query/agent.query.ts` (useProjectAgentRuns, useAgentRun polling while live, useStartAgentPlan), `context/agent.tsx` (AgentProvider/useAgent: run, plan, checks, logs, per-check answers + submit).
- Project detail page: "Agent Run" button right of "Run scan". Shows "Agent running..." when an AGENT worker is active (worker-status), "Resume agent" when a non-terminal run exists, else "Agent Run" -> starts the plan and navigates. Errors via sonner toast (Toaster mounted in QueryProvider).
- Agent screen (`.../agent/[agentId]`) now reads live data via AgentProvider: left = chat (activity logs + the single plan card with per-check Q&A + Submit), right = Checks / Changes (from targetPages) / Code (placeholder until fix run).

Pending:

- Submit currently sets local state only; the answer-persist + fix-run route (route 2) isn't built. Wire Submit -> PATCH answers + start fix workflow.
- AGENT worker rows aren't reconciled via the worker-status fallback (only the activity writes their terminal status); fine for now since the worker writes it directly.

## Agent plan: AI-connected + live chat polling

Done:

- AI planner wired (`agent-plan/planner.ts` `aiPlanCheck`): one bounded OpenRouter call per check (scan-grounded, no repo clone) returns mode (AUTO/NEEDS_INPUT/MANUAL) + approach + targetPages + question/options + a chat narration. Deterministic `planCheck` is the fallback on any error (no key / bad JSON), so planning always completes.
- `planCheckActivity` now streams the model's narration into `logs` as `agent_message` rows (per check) and `startSandboxActivity` posts an opening "reading the scan findings..." message, so the chat fills in for real. `plan_proposed` (with agentPlanId) still anchors the plan card.
- Frontend polls `GET /api/agent-runs/:id` every 3s while the run is WORKING (QUEUED/PLANNING/FIXING/VERIFYING/OPENING_PR); stops at AWAITING_INPUT/terminal.
- Agent screen shows real data when a run exists (dummy only as a no-run preview). Logs render as chat bubbles; the plan is one agent message with a numbered check list + inline options.

Notes / pending:

- Needs `OPEN_ROUTER_KEY` + `LLM_MODEL` set for real AI output; otherwise it cleanly falls back to deterministic planning.
- Still requires the agent DB migration applied + `bun run worker` running.
- Submit still local-only (route 2 not built).

## Agent planner reworked into a real agentic run

Done:

- Single activity `runPlannerAgentActivity` now does the full flow: (1) create sandbox + log, (2) clone the repo using the project's GitHub account token + log, (3) run the model via `runAgent` with read-only sandbox tools (list_dir/read_file/run_command) so it inspects the repo, (4) every assistant sentence -> `agent_message` log, every tool call -> `tool_call` log (e.g. `$ grep ...`, `Reading app/layout.tsx`), (5) parse the plan JSON -> persist AgentPlanCheck rows + the final `plan_proposed` message, (6) kill sandbox + clear `agentRun.sandboxId`. Token tracked on the run.
- Fallbacks: clone fail or no OPEN_ROUTER_KEY -> deterministic scan-grounded plan (still persists). Workflow runs the activity once (no retry, to avoid duplicate clones/logs).
- Frontend: dummy data removed. Agent screen renders real logs only — activity bubbles, `tool_call` rows shown as a terminal block, then the final plan message with the numbered checks + inline choices. Loading / "Building the plan..." / not-found / failed states added.

Needs to actually run: agent DB migration applied, `bun run worker` up, and OPEN_ROUTER_KEY + LLM_MODEL + E2B_SANDBOX_API_KEY set, plus the project's GitHub account token (for cloning private repos).

## Fix run (route 2) — submit plan -> apply fixes -> open PR

Done:

- Schema: added `LogSource.AGENT_FILE` (code-change/build logs, shown on the right panel, not the chat). `prisma generate` run; needs migration.
- New Temporal queue `agent-fix` (+ `agent-fix-worker`), registered in worker/index.ts.
- `POST /api/agent-runs/:id/fix` -> `startFix`: guards `status === AWAITING_INPUT` (rejects double-submit with 409), persists each NEEDS_INPUT answer (choice/selectedOption/userSuggestion) onto AgentPlanCheck, sets plan SUBMITTED + run QUEUED, enqueues `agentFixWorkflow`.
- `agentFixWorkflow`: fixSetupActivity (create sandbox + save id + clone + resolve approved checks) -> fixCheckActivity per check (own activity; runAgent with read/edit/write/run tools; narration -> AGENT chat logs, edits/commands -> AGENT_FILE logs; sets check outcome FIXED/FAILED/SKIPPED) -> fixVerifyActivity (bun/npm install + build, best-effort) -> fixOpenPrActivity (branch + commit + push with account token + open PR via GitHub REST, save prUrl/prNumber/branch/prState/fixedChecks on AgentRun) -> fixTeardownActivity (kill sandbox + clear sandboxId). Single attempt.
- Frontend: Submit disabled until every NEEDS_INPUT question is answered; calls `useStartFix`; once submitted the plan locks (driven by server status != AWAITING_INPUT) so it can't be re-clicked. Backend 409 also blocks double-submit.
- Agent screen right panel: Changes tab shows real `file_change` AGENT_FILE logs (falls back to planned target pages pre-fix); Code tab shows commands + build output as a terminal stream. Chat (left) only shows AGENT logs.

Needs: migration applied (agent tables + AGENT_FILE enum), worker on the SAME DATABASE_URL as the API, and OPEN_ROUTER_KEY/LLM_MODEL/E2B + the project's GitHub token (repo scope) for clone/push/PR.

## Image generation tool (@repo/ai) — OpenRouter (default) + Vertex

Done:

- `packages/ai/image.ts`: `generateImage({ prompt, aspectRatio, ..., provider })` with two providers:
  - `openrouter` (DEFAULT) — uses the SAME `OPEN_ROUTER_KEY` via chat completions with `modalities: ["image","text"]` on `google/gemini-2.5-flash-image`. No extra creds. Reads the base64 off `message.images`.
  - `vertex` — Imagen `:predict` (needs a GCP service account; secrets already added).
- `imageTool({ onImage, provider })` AgentTool (`generate_image`); generation here, persistence via callback.
- Wired into the fix agent: when `OPEN_ROUTER_KEY` is set, `fixCheckActivity` adds `generate_image`, writing the PNG into the cloned repo (e.g. a missing OG image) and logging it as an AGENT_FILE `file_change`.
- (Replaced the earlier Vertex-only `vertex-image.ts` with the multi-provider `image.ts`.)

## Post-PR chat + run lifecycle (chat / complete / one-open-run / history)

Done (backend):

- `lib/github.ts` `getPrStatus()` — reads a PR's merged/closed state with the user's token.
- `POST /api/agent-runs/:id/chat` -> `startChat`: guards (PR must exist, live GitHub merge check sets `prMerged`, blocked if merged or `chatMessagesLeft<=0`), persists the user message as a `USER` log, decrements `chatMessagesLeft`, sets status `CHATTING`, enqueues `agentChatWorkflow` (queue `agent-chat`, workflowId unique per turn).
- `agent-chat` worker: `runChatActivity` revives the run's sandbox (or creates + re-clones the fix branch, keeps it ALIVE), rebuilds memory context from DB (plan summary, check outcomes, changed files, recent USER/AGENT transcript), runs the chat agent with edit/run tools + image tool, commits + pushes to update the PR, logs to AGENT/AGENT_FILE, then re-checks merge and returns status to PR_OPENED. Sandbox is NOT killed.
- `POST /api/agent-runs/:id/complete` -> `completeAgentRun`: reflects real PR state via GitHub, sets `prMerged=true` so a new run can start.
- One-open-run guard in `startAgentPlan`: 409 if the project already has an open run (`prMerged=false` and non-terminal).
- Run summary DTO now includes `prMerged`, `branch`, `chatMessagesLeft`, `isOpen`.

Done (frontend):

- Agent screen: real chat composer (enabled once PR exists; shows "N messages left"; disabled while CHATTING / when merged / when budget 0). USER messages render right-aligned. Polls during CHATTING.
- Project page: "Agent runs" history list (every run, status/merged badge, links to its screen); button shows "Resume agent" + "New run" (-> complete-confirm dialog -> complete + start new) when a run is open, else "Agent Run".
- Composer PR-merged state: when `prMerged` is true the chat box is disabled with "This run is complete. The PR has been merged." placeholder, a "PR merged" label (filled GitPullRequest icon), and a disabled green-tinted "PR merged" send button (filled CheckCircle). Zero-budget is a separate muted box. Chat markdown rendering via `<Markdown>` (react-markdown + remark-gfm).

Migration still pending (owner): agent tables + `USER` log source + `CHATTING` status + `prMerged`/`chatMessagesLeft` columns.

## AEO delivery checks (dualmark-aligned) — rubric + scraper + agent

Motivated by dualmark (dodopayments/dualmark): its `verify` scores ONE thing deeply — markdown-twin
delivery over HTTP content negotiation + a header contract — which our old single `markdown-twins`
check (a regex for a `<link rel=alternate>` tag) barely touched. Deepened that axis while keeping our
24-check breadth.

Done:

- RUBRIC.md: replaced check #23 `markdown-twins` with three checks — `markdown-twin` (Content, B,
  medium), `content-negotiation` (Crawl surface, A, medium, #25), `ai-delivery-headers` (Crawl
  surface, A, low, #26). Kept within existing categories (no new category, no frontend change).
- `check-intent.ts`: same three entries, IDs/tiers/weights identical to RUBRIC.md.
- Scraper probe (`fetcher.ts`): `rawFetch` now takes `{ headers }`; new `twinUrlFor()` + `probeTwin()`
  fetch `<path>.md` and re-request the HTML URL with `Accept: text/markdown` and a GPTBot UA (3 cheap
  parallel requests/page). Returns twin reachability/content-type/headers + negotiation results +
  HTML `Link` alternate header. Wired into `run.ts scorePage` -> `CheckContext.twin`.
- Evaluators (`activities.ts`): `markdown-twin` (200 + text/markdown + non-empty), `content-negotiation`
  (Accept + bot-UA both serve markdown), `ai-delivery-headers` (X-Robots-Tag noindex, Vary: Accept,
  X-Markdown-Tokens on twin + Link rel=alternate header on HTML). SUCCESS/MID/FAILED like every check.
- Agent fix: skills replaced (markdown-twin.md, content-negotiation.md, ai-delivery-headers.md; deleted
  markdown-twins.md — skills.test still 1:1 with rubric). Fix system prompt (agent-fix), planner.md, and
  the inline planner AUTO rule (planner.ts) now plan/fix these as AUTO, **hand-written framework-idiomatic
  code (route/handler + middleware + headers), never adding a third-party dep (@dualmark/\*) to the user repo**.
- Verified: backend-v2 check-types clean; agent skills test passes; live smoke — dualmark.dev scores
  twin PASS / negotiation PASS / headers MID(3/4); linkrunner.io scores twin PASS / negotiation FAILED /
  headers PASS (accurate, discriminating per layer).

Notes:

- Scoring is now stricter: most sites FAIL the 3 delivery checks (no twins), which is intended (matches
  dualmark's stance) and gives the agent concrete fix targets.
- apps/web demo-data.ts still shows the old `markdown-twins` id (marketing illustration only, not the
  checker) — update if we want the demo to mirror the new IDs.
- Follow-up (separate): make geo.repair (apps/web) pass these — it serves static .md files with no
  negotiation/header contract today.

## Fix-run cost reduction (workstream B) — batching + context reuse + model routing

Goal: one fix run was expensive because each check ran as a SEPARATE runAgent session
(maxSteps 20) that re-explored the repo from scratch — 15 checks = 15 re-discoveries.
Research basis: prompt-cache/context reuse cuts cost 40-90%; batching shared context is the
big lever; model routing to a cheaper tier keeps ~95% quality at 45-85% lower cost.

Done (backend-v2 `agent-fix`):

- **Batching**: `groupChecks()` buckets approved checks by shared surface into a few groups —
  `crawl` (robots/sitemap/llms.txt/indexability), `head` (meta/OG/canonical/JSON-LD/favicon/
  hreflang/charset/doctype/viewport/social-image-size), `semantics`, `content`, `aeo-delivery`
  (markdown-twin/content-negotiation/ai-delivery-headers). Unknown ids get their own group.
- Workflow now loops GROUPS, not checks: `fixSetupActivity` returns `groups` (+ flat `checks`,
  `repoSummary`); new `fixGroupActivity` runs ONE runAgent per group so shared files are read once.
  Replaced per-check `fixCheckActivity`. Steps budgeted `min(40, 10 + 6*checks)`.
- **Context reuse**: the planner's `AgentPlan.summary` (stack/layout/content sources it already
  found) is injected into the fix system prompt so the fix agent does NOT re-discover the repo.
- **Model routing**: added `LLM_MODEL_CHEAP` secret + `CHEAP_MODEL` export. Mechanical groups
  (`crawl`, `head`) use the cheap model; `semantics`/`content`/`aeo-delivery` use `DEFAULT_MODEL`.
  No-op until `LLM_MODEL_CHEAP` is configured (defaults to LLM_MODEL).
- Outcomes still set optimistically FIXED per group (matches prior behavior); workstream A's
  verify-and-iterate rescan will make them truthful. Image tool + AGENT/AGENT_FILE logging kept
  (file_change tagged with the group id).
- Verified: backend-v2 check-types clean.

Deferred (intentionally, for safety): true no-LLM deterministic fixers for templated checks
(charset/doctype/viewport/robots/sitemap/llms.txt). Higher risk across arbitrary stacks; the
batching + routing above is the high-ROI, low-risk subset. Revisit if cost still too high after A.

Next: workstream A (verify-and-iterate loop — build+serve in sandbox, rescan with runScrape,
re-fix still-failing checks up to ~3 iterations, mark outcomes from the rescan).

## Verify-and-iterate loop (workstream A) — one run reaches the real score

Problem: the fix run marked every check FIXED on the agent's word and never re-checked, so the
true score only emerged on a fresh AgentRun (the "run it 3 times" pain). Research basis: self-
correcting coding agents (Socratic-SWE) keep improving and plateau around 3 passes; the gate that
makes cheap-model routing safe is re-verifying against the same checker.

Done (backend-v2 `agent-fix`):

- New `@repo/sandbox` helpers: `startBackground()` (E2B `commands.run({background:true})` -> pid +
  kill) and `getSandboxHost(sandbox, port)` (public HTTPS host for a port inside the microVM).
- New `fixRescanActivity`: detects how to serve the repo (a `start` script, else a static dir via
  `bunx serve`), installs + builds, starts the server in the background, polls `https://<host>`
  until up, then runs our own `runScrape` against it (maxPages 6). Maps each approved check to the
  REAL result: SUCCESS -> outcome FIXED ("verified passing"); FAILED/MID -> outcome FAILED with the
  re-scan summary, and collected as `stillFailing`. Sets `AgentRun.scoreAfter` from the re-scan.
  Returns `{ ok, score, done, nextGroups }`. Best-effort: build/serve failure returns ok:false.
- Workflow loop (`agentFixWorkflow`): fix groups -> rescan -> if `done` stop; else re-fix only
  `nextGroups` (still-failing checks, with the re-scan feedback appended to their recommendation),
  up to `MAX_ITERATIONS = 3`. If a rescan can't build/serve, falls back to the legacy build-only
  `fixVerifyActivity` and opens the PR (never blocks). Activity timeout raised to 30 min.
- Outcomes + `scoreAfter` are now truthful (measured), and the PR's "N fixes" count reflects
  verified passes. `scoreBefore` already came from the originating scan, so the before/after delta
  is real. Status shows VERIFYING during each re-scan (badge already existed).

Notes / tradeoffs:

- The re-scan serves the freshly-built FIXED code on localhost and scans that; before (live scan)
  vs after (built fixed code) is the right comparison. Small page-count difference (6 vs up to 20)
  can nudge the rollup slightly.
- Serving arbitrary stacks is the main failure point; it's defensive and best-effort, so a repo we
  can't serve still gets a PR with optimistic outcomes + a clear "couldn't auto-verify" log.
- Cost: each iteration does install+build+serve+scan. Capped at 3 and re-fixes only what still
  fails, so most runs converge in 1-2 passes. Workstream B's batching keeps the fix passes cheap.
- Verified: backend-v2 check-types clean; agent skills test passes.

## Net-new page proposals (workstream C) — planner is realistic + proactive

Problem: the planner only fixed failing checks on existing pages; it never proposed creating a
high-value page that's simply missing. Evidence (more-of-agent.md / GEO studies): comparison/"X vs
Y" pages earn ~32% more AI citations, original-data pages make you the cited source, FAQ/glossary
give extractable Q&A + definitions, about/contact strengthens E-E-A-T.

Done (backend-v2):

- Planner agent (`PLANNER_AGENT_SYSTEM`): added a `newPages[]` array to its JSON output + guidance
  to propose 0-3 genuinely-missing high-value pages, prioritised by the citation evidence above.
  Strict honesty: gated yes/no, built only from existing site content or user-provided facts, never
  inventing claims/stats/pricing/competitor details; never propose a page that already exists.
- `mapParsedToPlanned`: maps each `newPages` item to a gated NEEDS_INPUT `AgentPlanCheck` with a
  UNIQUE synthetic `new-page-<kind>` id (the table has `@@unique([agentPlanId, rubricId])`),
  category Content, tier C, **weight 0 (never scored)**, action "create", and the standard
  yes_existing / yes_provided / no options. They surface in the plan card like any "need you" item,
  so the user must explicitly approve them before the fix run creates them.
- Fix agent (`fixSystemPrompt`): handles `new-page-*` checks — create the route idiomatic to the
  stack, structured for AI extraction (one h1, question headings, answer-first 50-150 word chunks,
  comparison table where relevant), add JSON-LD + nav/sitemap/llms.txt links + a markdown twin,
  using ONLY existing/provided facts. Each net-new page becomes its own fix group (strong model).
- The re-scan loop (workstream A) leaves these as their optimistic outcome (no deterministic check
  for "good comparison page"), but they lift the scored checks (answerability, definitions,
  internal-linking, markdown-twin) indirectly.
- Docs: planner.md "Net-new page proposals" section; RUBRIC.md planned-expansions note. No frontend
  change (NEEDS_INPUT + options already render in the plan card).
- Verified: backend-v2 check-types clean; agent skills test passes (synthetic ids aren't canonical
  checks, so no skill-sync break).

## Fix: agent runs list needed a manual refresh

`useProjectAgentRuns` had no polling; with the global `staleTime: 30_000` + `refetchOnWindowFocus:
false`, returning to the project page after starting a run served stale cache, so the new run only
appeared after a hard refresh. Fix: `refetchOnMount: "always"` + a `refetchInterval` (4s) that polls
only while a run is actively working (`isAgentRunWorking`) and stops once runs settle. Dashboard
typecheck clean (only the pre-existing calendar.tsx error remains).

## Free public checkup service (deploy-separately) — backend-v2/free

Standalone Express server that runs the SAME scraper/checker inline (no Temporal, no DB, no auth),
so free traffic never touches the paid control plane. `runScrape` is pure (only imports the scraper
modules), so this is a thin wrapper.

Done:

- `apps/backend-v2/free/index.ts`: Express (helmet + open CORS + json 16kb + per-IP rate limit 20/15m).
  Routes: `GET /` (health), `POST /scan-website` and `GET /scan-website?url=` -> calls `runScrape`
  inline and returns the full result. Free bounds: maxPages 5 (hard cap 10), maxPerSection 2,
  concurrency 3, `singlePage` opt-in. Own PORT (`PORT` / `FREE_PORT`, default 4100).
- Scripts: `open` in backend-v2 (`bun run free/index.ts`) + root `backend:open`
  (`bun run --filter=@repo/backend-v2 open`). Run with `bun run backend:open` (or npm).
- Verified: check-types clean; live smoke — health OK, `POST /scan-website {url:"linkrunner.io",
singlePage:true}` -> status completed, score 94, 27 checks.

Deploy: ship `apps/backend-v2` with start command `bun run free/index.ts` on its own host; the
platform's PORT is honored. No DB/Temporal/secrets required for this endpoint.

## Free scan wired into the landing page (apps/web) + zod validation (free server)

Done:

- `free/index.ts`: added zod request validation (`ScanRequestSchema`) — normalizes bare hosts to
  https, rejects non-http(s) / dotless hostnames with a friendly message, coerces `maxPages` (1-50),
  optional `singlePage`. Applied to both `GET` and a new `POST /scan-website`. Added `GET /health`
  (status/uptime/timestamp, not rate-limited). Added `zod` to backend-v2 deps.
- `@repo/secrets/frontend`: added `OPEN_BACKEND = NEXT_PUBLIC_OPEN_BACKEND_API`. Documented the var
  in `apps/web/.env.example`. Added `@repo/secrets` to apps/web deps.
- New `apps/web/components/checkup/free-scan-form.tsx` (client): URL input -> `POST {OPEN_BACKEND}/scan-website`
  -> renders ScoreRing (overall), category bars (from `score.byCategory`), and top issues (FAILED/MID
  checks by weight). Loading + error + "run another" states. PostHog events reuse
  checkup_started/completed/failed. Replaced the "Free scan coming soon" block in
  `components/sections/landing.tsx` with this form (re-enabled CornerMarks).
- Completed free scans auto-scroll the results panel into the viewport, with
  reduced-motion respected.
- Free scan fix handoff now targets `/dashboard/projects?website=...`, defaults
  to `http://localhost:3000` in local dev when `NEXT_PUBLIC_DASHBOARD_URL` is
  not set, and production still defaults to `https://dashboard.geo.repair`.
  Dashboard keeps `/onboarding` as a compatibility redirect and pre-fills the
  create-project dialog from the scanned website query param.
- Verified: backend-v2 check-types clean, web typecheck clean, new files lint clean; live smoke —
  invalid url -> 400 zod message, `/health` OK, `POST /scan-website {linkrunner.io, singlePage}` ->
  completed, score 94.

Note: pre-existing lint error in `apps/web/app/(marketing)/blog/[slug]/page.tsx:90` (no-explicit-any)
is unrelated to this change but will fail `next build`/the web deploy until fixed.
