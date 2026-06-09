
there is cdn that provides old cache after deployment too

## Scan run (backend-v2 + dashboard-v2)

Done:
- API scan (`POST /api/projects/:id/scan`) always enqueues the Temporal `scrapeWorkflow`; CLI (`bun run scraper`) still runs inline, no queue.
- Worker activity persists logs + result + status via `persist.ts` (shared with the inline/CLI path).
- Endpoints: `GET /api/projects/:id/scrapings` (history), `GET /api/scrapings/:id/reconcile` (sync DB with Temporal), `GET /api/worker-status?projectId=` (active QUEUED/RUNNING).
- Dashboard project detail rebuilt (Vercel-style): run-history dropdown, status/score/pages/started meta grid, category strip, collapsible activity logs + checks + recommendations.
- `useWorkerStatus` hook + `LiveActivity` panel (per-project now, reusable globally).

Pending:
- Run the DB migration for `Scraping` / `Log` / `WorkerStatus` / `Project.websiteError` (owner runs migrations).
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
  code (route/handler + middleware + headers), never adding a third-party dep (@dualmark/*) to the user repo**.
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
