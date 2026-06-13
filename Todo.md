## Project-first dashboard IA and friendly URLs

Done:

- Added stable dashboard slugs for projects, scans, and fix-agent runs while
  keeping internal IDs as backend source of truth.
- Dashboard root now resolves the selected project and redirects to
  `/dashboard/:projectSlug`; old ID routes still resolve and redirect.
- Top bar owns project switching and creation. The sidebar is scoped to the
  selected project: Overview, AI Visibility, Fix Agent, Scans, Usage, Settings,
  and Support.
- Checkout returns, transactional email dashboard links, scan links, and agent
  links now use project/run slugs where possible.
- AI Visibility interest capture now stores the selected project context.
- Updated `docs/system-flow.md` for the new route, selection, billing return,
  email, and project-scoped AI Visibility flow.

Pending:

- Apply the slug and feature-interest project-context migrations to production
  if it uses a different database.

## Transactional Resend emails

Done:

- Wired `@repo/email` into the live waitlist/contact routes, backend auth, scan,
  billing, agent plan/fix, and chat-limit lifecycle triggers.
- Retired the old app-local Resend helper so user-facing emails now go through
  the shared React Email templates.
- Updated `docs/system-flow.md` to show Resend notifications as best-effort
  user handoffs.

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
- Dashboard project page now creates checkout from a completed scan before starting the agent. Project-linked checkout returns to `/dashboard/:projectSlug?order_id=...&start_fix=1`, reconciles the payment, asks for confirmation, and then starts the agent run from the paid order.
- Applied the billing tables/enums to the currently connected Neon DB while
  repairing migration drift.

Pending:

- Verify the same billing migration state in production/Vercel if it uses a different DB.
- Confirm Dodo live product IDs match Starter, Growth, and Scale.
- Smoke test a test-mode checkout, Dodo return reconciliation, and webhook delivery before public launch.

## AI Visibility placeholder

Done:

- Added the project-scoped `AI Visibility` dashboard sidebar tab and `/dashboard/:projectSlug/ai-visibility` coming-soon page.
- Added authenticated interest capture through `feature_interests` with the `AI_VISIBILITY` feature key and selected project context.
- Documented the future product goal, sample-based reporting guardrails, and intended architecture in `docs/ai-visibility.md`.
- Applied the `feature_interests` migration to the currently connected Neon DB.

Pending:

- Verify the same feature-interest migration state in production/Vercel if it uses a different DB.
- Replace the interest CTA with the first real snapshot workflow when prompt monitoring starts.

## Scan run (backend-v2 + dashboard-v2)

Done:

- Free scan "Start the fix" handoff now carries
  `/dashboard/projects?website=...` through Google sign-in and GitHub connect.
  When exactly one safe repo match exists, the dashboard creates the project and
  relies on the backend's first-scan enqueue. Otherwise, the repo picker opens
  with the scanned website prefilled.
- Repo picker now behaves like one attached dropdown input: selected repos show
  a checkmark, options collapse after selection/outside clicks/focus loss, and
  keyboard navigation supports arrows, Enter, Escape, Home, and End.
- Repaired the currently connected Neon DB migration state so `projects`,
  `scrapings`, `logs`, `worker_status`, agent, billing, feature-interest, and
  project brand-identity tables/columns exist.
- Create-project API now keeps unexpected Prisma failures out of the UI and
  returns a generic error while logging the server-side detail.
- API scan (`POST /api/projects/:id/scan`) always enqueues the Temporal `scrapeWorkflow`; CLI (`bun run scraper`) still runs inline, no queue.
- Worker activity persists logs + result + status via `persist.ts` (shared with the inline/CLI path).
- Completed scans now extract site identity from homepage icons and JSON-LD: brand name, favicon URL, and logo URL. Project scans persist those URLs on `Project`; free scans return them in the scan result.
- Endpoints: `GET /api/projects/:id/scrapings` (history), `GET /api/scrapings/:id/reconcile` (sync DB with Temporal), `GET /api/worker-status?projectId=` (active QUEUED/RUNNING).
- Dashboard project list/detail now use the discovered favicon when available, with the globe fallback preserved.
- Web free-scan and `/report` surfaces now show the scanned site's favicon for personalization.
- Homepage results, `/report`, and dashboard scan detail now show 100-block
  score strips for overall and category scores.
- Dashboard project detail rebuilt (Vercel-style): run-history dropdown, status/score/pages/started meta grid, category status rows, internally scrollable checks, and compact recommendations. Technical activity logs stay internal.
- Dashboard query data and the selected scan run persist across hard refreshes in
  the current tab, then refetch in the background for fresh data.
- Dashboard auth and route loading now use the existing app shell with inline
  skeletons instead of blanking the whole app with the full-screen loader.
- Dashboard root now disables vertical overscroll bounce on `html` and `body`.
- Added a repair migration for project-linked checkout orders, restoring
  `orders.projectId` and `orders.scrapingId` on drifted databases.
- Buy now opens a plan confirmation modal first. The applicable tier is
  preselected, lower tiers are disabled, and higher self-serve tiers can be
  selected before checkout starts. Enterprise stays out of the picker, and the
  payment CTA is explicit. Plan cards highlight page-count coverage with a
  compact less/more/most graphic and shared benefit bullets.
- Dodo returns project-linked payments to the project detail page, where the
  paid order is reconciled and the user confirms before the agent run starts.
  The public checkout return page now acts as a fallback handoff to the dashboard.
- Local Temporal task queues are suffixed in development, so local workflows do
  not get consumed by another environment's worker while pointing at the wrong
  database.
- Agent-run reads reconcile failed Temporal workflows back into `AgentRun`,
  `AgentPlan`, and `WorkerStatus`, preventing the dashboard from hanging in
  planning when the workflow has already failed.
- Failed agent-run screens now show a clear recovery state with retry and
  project-return actions, instead of leaving users at an empty checks view.
- Buttons now use pointer cursors across shared UI primitives and raw button
  fallbacks in the web and dashboard apps.
- Agent chat now groups agent activity under one header and renders messages,
  commands, tool calls, file changes, repo clone, verification, and PR events
  flat on the thread background: agent messages full opacity, tool/activity rows
  faded, with no message bubbles or tool labels.
- Agent plan previews now open read-only in the right-side artifact panel. The
  chat thread keeps the confirmation/questions and submit action.
- Agent-run checks stay hidden during plan approval and render as compact status
  rows after the fix starts, with page/file detail kept in the Changes tab.
- Agent-run contrast tightened across the chat thread, plan artifact, checks,
  changes, and composer helper states so the screen is easier to read.
- Plan confirmation cards now use stronger nested surfaces, readable radio
  indicators, and a clearer note field.
- Agent conversation scroll area now reserves scrollbar gutter space and has
  extra right padding so content does not crowd the scrollbar.
- Agent screen styling now has inline code comments around the chat width,
  scrollbar padding, plan approval card, radio indicators, right artifact,
  checks rows, and tool/activity rows for easier manual editing later.
- Agent narration color now follows each individual message level instead of
  inheriting warning/error color from nearby tool rows.
- Agent conversation now shows a bottom "Agent is working..." indicator only
  during active agent states, and hides it for user input, blocked, or done states.
- Agent composer keeps the message-count helper visible while sending; the send
  button spinner and thread-end indicator carry the working state.
- Agent composer send control is icon-only: right arrow when ready, spinner
  while sending.
- Agent chat composer now uses a contentEditable textbox instead of a textarea,
  avoiding password-manager autofill overlays on focus.
- Agent chat now renders user-sent messages in right-aligned bubbles while
  keeping agent messages flat.
- Agent chat now sends on Enter, keeps Shift+Enter for line breaks, and inserts
  an optimistic user bubble immediately while the backend starts the chat turn.
- Agent run floating controls now show check progress as done/total alongside
  the score target.
- Agent chat activity now collapses raw tool and command logs into target-aware
  summaries like `Searched for "agents"`, `Read AGENTS.md`, and `Edited AGENTS.md`.
- Fix-run build verification now hard-fails before PR creation. If install/build
  exits non-zero, the run is marked failed and no branch is pushed.
- Fix-run PR creation now also requires at least one check verified as fixed, so
  changed files alone cannot open a PR.
- Fix-run PR creation now blocks partial-success PRs at the score level. The
  latest validation scan must reach 100/100 before a PR opens, unless every
  remaining scored blocker was explicitly skipped by the user.
- Fix workflow now pauses after repeated unresolved blockers or broad-change
  blockers and asks MCQs: retry with bigger changes or skip the check. User
  decisions resume the same Temporal workflow via signal.
- Revalidate now queues a preset chat-agent turn instead of a verify-only
  workflow. It spends from the same follow-up AI credit balance.
- Post-PR chat edits now have the same validation gate: the agent is instructed
  to call `validate_pr_branch` after edits, and the harness refuses to push if
  validation did not pass on the latest changed tree.
- Revalidation now returns detailed score-blocker data to the chat agent, keeps
  tools available after the wrap-up nudge, and steers the agent toward website/
  app edits instead of spending the turn only auditing checker internals.
- Agent narration prompts now ask for more human, varied, context-aware
  sentences and explicitly avoid repetitive "I will..." tool prefaces.
- Post-PR chat and revalidation turns now ask the agent to finish with a
  detailed multi-paragraph summary, and the closing message is stored with a
  larger limit so the dashboard does not truncate it immediately.
- Post-PR chat updates the current PR while it is open. If GitHub reports the
  latest PR as merged or closed, the next message opens a follow-up PR in the
  same agent thread. Chat sandboxes are kept warm for 15 minutes after each
  turn, then E2B expires them.
- Agent run page now centers the chat as the main surface, with a vertical
  floating context toolbar and animated on-demand right preview for plan,
  checks, and changes. The preview takes layout space and pushes the chat and
  toolbar left; the run header spans the full agent page above those surfaces.
- `useWorkerStatus` hook + `LiveActivity` panel (per-project now, reusable globally).

Pending:

- Verify the same scan/project migration state in production/Vercel if it uses a different DB.
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
- `agentFixWorkflow`: fixSetupActivity (create sandbox + save id + clone + resolve approved or automatic score blockers) -> grouped fix activities by shared surface -> fixRescanActivity (build/serve + local scanner against original scan paths) -> repeat fresh grouped repair activities until the latest validation reaches 100/100 or remaining scored blockers are user-skipped -> fixVerifyActivity -> assertPrReadyActivity -> fixOpenPrActivity (branch + commit + push with account token + open PR via GitHub REST, save prUrl/prNumber/branch/prState/fixedChecks on AgentRun) -> fixTeardownActivity.
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

## Agent lifecycle simplified to one paid thread

Done (backend):

- `lib/github.ts` `getPrStatus()` — reads a PR's merged/closed state with the user's token.
- `FIX_ATTEMPT_LIMIT` is now 1. Each paid order gets one fix agent thread and
  tiered follow-up AI credits: Starter 3M, Growth 10M, Scale 25M.
- `startAgentPlan` resumes the existing live project agent thread instead of
  requiring the user to close a run or start a new one.
- `POST /api/agent-runs/:id/complete` was removed from backend routes and
  client APIs.
- `POST /api/agent-runs/:id/chat` now checks `Order.aiCreditsIncluded` /
  `Order.aiCreditsUsed`, records the user message without upfront spend, and
  no longer blocks when GitHub reports the latest PR as merged or closed.
- `agent-chat` worker updates the existing PR branch while the latest PR is
  open. If it is merged or closed, the worker clones the default branch, creates
  a follow-up branch, opens a new PR, and stores the new PR as the run's latest
  target while keeping the same transcript.
- The internal revalidate endpoint now uses the same AI credit balance instead
  of `manualRevalidationsUsed`.
- Run summaries derive AI credit balance from the order and keep merged PR
  threads resumable. Actual input/output token usage is recorded in
  `ai_usage_events` and increments `Order.aiCreditsUsed`.

Done (frontend):

- Agent screen chat stays enabled after PR merge/close until the AI credit
  balance is exhausted. Follow-up mode uses a shorter placeholder.
- Project page removed the "New run" button and close-run dialog. The primary
  action is Resume agent, Start agent, or Buy now.
- Project page now shows AI credit balance instead of agent-run availability.
- The separate Revalidate buttons were removed from the dashboard; users ask the
  agent in chat when they want another pass.
- Build cleanup: public Next route handlers with dynamic params now use the
  Next 16 Promise-only route context shape.
- Agent detail now returns the newest chat logs plus the latest plan card, so
  long-running threads do not hide fresh user messages and agent updates.
- Agent chat now enters repair mode when the user asks to fix/revalidate pending
  checks after a failed validation. The worker feeds the latest validation
  blockers as a structured work queue and uses a larger 180-step bounded tool
  budget.

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

- **Batching**: `groupChecks()` buckets repairable score blockers by shared surface into a few groups —
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
  until up, then runs our own `runScrape` against it with the original scan paths pinned into the
  validation input. Maps every scored blocker to the REAL result, creates plan rows for newly
  discovered blockers, and sets `AgentRun.scoreAfter` from the re-scan. Returns `{ ok, score,
  done, nextGroups, needsDecision }`.
- Workflow loop (`agentFixWorkflow`): fix groups -> rescan -> if the score gate passes, stop; else
  re-fix only `nextGroups` with a fresh agent activity. The old `MAX_ITERATIONS = 3` terminal cap
  is gone; after repeated misses, or when a blocker needs broad/manual approval, the workflow asks
  retry-or-skip MCQs and resumes via signal. A build/serve/scan failure no longer falls back to a
  build-only PR path.
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

## Agent revalidation chat stability

Done:

- Dashboard run detail now keeps polling in the background while a run is working.
- Sending a chat message invalidates the run detail on both success and error, so a rejected send
  refetches the latest status instead of leaving the screen stale.
- Post-PR chat/revalidation workflows now have a 60-minute activity timeout instead of 15 minutes,
  because revalidation can include install, server startup, local scanning, fixes, and rebuilds.
- If the long chat/revalidation activity still times out or fails before its own cleanup runs, the
  workflow now calls a short cleanup activity that logs the failure and releases the run from
  `CHATTING` back to `PR_OPENED`.
- Root cause of the observed timeout: the agent used raw `run_command` for `bun run build`, and
  that generic shell tool had no default timeout. It could block until Temporal killed the whole
  activity. Generic sandbox commands are now bounded to 2 minutes by default and capped at 5 minutes;
  long build/serve/scan validation is routed through `validate_pr_branch`.
- Raw command results are now logged as `command_result`, so the dashboard shows whether a diagnostic
  command returned, failed, or timed out instead of only showing that it started.
- Revalidation turns now carry the latest validation result, including `approvedCheckFailures`, back
  into the next model context so the agent starts from the actual failing checks instead of
  rediscovering scraper scripts.
- Broad `find .` diagnostics are blocked in sandbox tools because they dump `node_modules`/build
  output and derail the turn. Chat/revalidation command output is capped more tightly.
- Revalidation tool budget was raised, but only after adding stricter tool/output guardrails.
- If the model reaches its step limit or validation still fails, the harness now writes a deterministic
  final summary from validation state instead of showing the model's last unfinished thought.
