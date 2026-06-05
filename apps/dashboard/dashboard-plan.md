# Dashboard V1 IA And Fix-Agent Flow

## Summary

`dashboard.geo.repair` is the canonical authenticated dashboard origin for GEO Repair. The dashboard uses clean top-level routes instead of resource-heavy visible URLs, with a global active project selector controlling which website/repo/run context the user is working in.

The V1 dashboard focuses on the fix loop:

1. Run a website scan.
2. Continue into the fix agent.
3. Confirm repo, payment, and required setup.
4. Answer structured MCQ intake when needed.
5. Watch a read-only agent transcript while the fix runs.
6. After a build-passing PR opens, optionally use a scoped free-form refinement window.
7. Review the opened PR, summary, reports, and re-check state.

V1 implementation can remain in `apps/web`, but this file lives in `apps/dashboard/` as the repo-local dashboard planning artifact.

## Agreed Decisions

- Dashboard canonical origin is `dashboard.geo.repair`.
- Marketing remains on `geo.repair`.
- Visible dashboard routes are:
  - `/`
  - `/website-scan`
  - `/fix-agent`
  - `/reports`
  - `/settings`
- The UI uses "Project" rather than "Site".
- A project represents one website, repo link, checkups, runs, orders, PRs, reports, and future Autopilot history.
- Active project selection lives in the dashboard header.
- Active project selection is backed by server-side `User.lastActiveProjectId`.
- Local storage can cache the last selected project, but it is only a fallback.
- Query params are reserved for deep links and return flows, for example:
  - `?project=prj_123`
  - `?run=run_456`
  - `/fix-agent?project=prj_123&run=run_456`
- The default user-facing URL should stay short, usually `https://dashboard.geo.repair/`.
- `/website-scan` routes completed scans into `/fix-agent`.
- `/fix-agent` contains setup, MCQs, live read-only agent transcript during the main run, post-PR refinement chat, paused input, PR result, and run history.
- `/reports` contains scan reports, fix summaries, co-branded PDFs, and share/export flows for the active project.
- The user cannot send arbitrary chat messages during the main fix run.
- Free-form chat opens only in Post-PR Refinement Mode after a build-passing PR has been created.
- The agent can pause for structured MCQ input, with optional free-text notes attached to specific questions.

## Core IA

### `/`

Dashboard home for the active project.

Primary jobs:

- Show current AI Search readiness score.
- Show latest scan status.
- Show next action.
- Show active run status, if any.
- Show PR status, if any.
- Show GitHub, payment, or intake blockers.
- Show actionable insight cards that route to the correct workflow.

Example cards:

- Run new scan -> `/website-scan`
- Continue fix -> `/fix-agent`
- Answer required questions -> `/fix-agent?run=run_456`
- Watch active run -> `/fix-agent?run=run_456`
- View PR summary -> `/fix-agent?run=run_456`
- View scan report -> `/reports?report=rep_123`
- Download client report -> `/reports?report=rep_123`
- Manage GitHub -> `/settings?tab=github`
- Manage billing -> `/settings?tab=billing`

Empty state:

- If the user has no projects, show a focused prompt to run a website scan.
- If the user has multiple projects but no active project, show the project selector.

### `/website-scan`

Website scan surface.

Primary jobs:

- Accept a website URL.
- Show existing checkup progress states:
  - queued
  - fetching homepage
  - reading crawl files
  - discovering pages
  - scoring pages
  - aggregating report
  - saving report
  - completed
  - failed
- Persist the completed scan as a project checkup.
- Create a project if none exists for that website.
- Update the active project after scan completion.
- Show score, website type, pages checked, and top issues.
- Route the user to `/fix-agent` with the completed project selected.

Unsupported platform behavior:

- Framer, Webflow, Wix, WordPress, Squarespace, Shopify, and other unsupported no-code platforms route to waitlist or contact.
- Unsupported platforms do not proceed into the paid fix flow.

Anonymous handoff:

- Anonymous marketing-site checkups can hand off into the dashboard using a signed report key.
- After auth, the dashboard imports that report key into a project and sets it as active.

### `/fix-agent`

Fix workspace for the active project.

Primary jobs:

- Show fix setup before a run starts.
- Show required MCQ intake before the run starts when possible.
- Start a fix run.
- Display the live read-only agent transcript.
- Render inline structured questions when a run enters `awaiting_input`.
- Show final PR result, skipped work, flagged manual work, generated assets, and report actions.
- Open Post-PR Refinement Mode after a build-passing PR is created.
- Show run history for the active project.
- Link completed scan, fix, and re-check artifacts into `/reports`.
- During an active fix, use a split workspace: left side agent timeline, right side tabbed technical detail.

`/fix-agent` state variants:

- no active project
- no scan yet
- repo connection required
- repo confirmation required
- unsupported stack
- checkout required
- MCQ intake required
- ready to start
- queued
- running
- awaiting input
- PR opened
- refinement open
- refinement closed
- merged
- re-check available
- failed
- no changes needed
- support required

Run deep links:

- `/fix-agent?run=run_456` opens a specific run transcript for the active project.
- `/fix-agent?project=prj_123&run=run_456` opens a specific run transcript and selects its project.

### `/reports`

Reports surface for the active project.

Primary jobs:

- Show all report artifacts for the active project.
- Show latest scan report.
- Show before and after readiness reports when a fix has run and re-check is available.
- Show PR-ready fix summary reports.
- Show co-branded client/leadership PDF reports.
- Let users download, copy share links, or regenerate reports when source data changes.
- Keep reports separate from the live agent transcript so `/fix-agent` stays focused on execution.

Recommended tabs:

- `scan`
- `fix-summary`
- `before-after`
- `exports`

Report types:

- Scan report: score, categories, website type, pages checked, top findings, off-site advisories, and quote tier.
- Fix summary report: fixed checks, skipped checks, flagged manual work, generated assets, files touched, build/typecheck result, and PR link.
- Before-after report: original score, re-check score, readiness delta, checks improved, checks still failing, and caveats.
- Co-branded PDF: GEO Repair branding plus customer/project identity, designed for leadership or agency-client sharing.

Report deep links:

- `/reports?report=rep_123` opens a specific report.
- `/reports?project=prj_123&report=rep_123` selects the project and opens a specific report.
- `/reports?tab=exports` opens report downloads and share links.

Report rules:

- Reports must be generated from stored checkup, run, PR, and re-check data.
- Reports must say "technical readiness" and never promise traffic, rankings, or citations.
- Public/share links must be signed or tokenized, revocable, and scoped to one report.
- Reports should not expose raw source code, secrets, full terminal logs, or private repo file contents.
- Agency/client-facing exports should show plain-language results and omit internal cost/debug metadata.

### `/settings`

Settings surface.

Primary jobs:

- Account settings.
- Billing and Stripe customer portal.
- GitHub installs and disconnect flows.
- Project selector management.
- Optional project archive/disconnect controls.

Recommended tabs:

- `account`
- `billing`
- `github`
- `projects`

## Active Project Resolution

Resolve the active project in this order:

1. Explicit `?project=` query param.
2. Server-side `User.lastActiveProjectId`.
3. Local storage cached project ID.
4. Auto-select the only project when the user has exactly one.
5. Otherwise show the empty or picker state.

Rules:

- Server state is the durable source of truth.
- Local storage is only a fast client fallback.
- Selecting a project from the header updates `User.lastActiveProjectId`.
- If a route is opened with `?project=`, validate the user can access that project before setting it active.
- If a selected project is missing, archived, or inaccessible, clear it and return to the picker or empty state.

## Fix-Agent Running UI

The fixing state in `/fix-agent` should feel like a read-only Codex, Bolt, Lovable, or similar agent session. The user can follow the agent's work in real time, but cannot send arbitrary messages.

Layout:

- Left panel: agent timeline.
- Right panel: technical workspace with tabs.
- Header: active project selector, run status, repo/branch summary, and primary run action when applicable.
- Mobile: stack the agent timeline first, then the technical tabs below.

Left panel, agent timeline:

- Chronological agent/chat log.
- Agent status messages.
- Plain-language summaries of what the agent is doing.
- Fix cards such as "Edit #28: Add llms.txt" or "Edit #29: Fix import error".
- Error cards such as "Build unsuccessful".
- MCQ questions and selectable answers.
- Required action buttons such as "Approve FAQ additions", "Skip comparison pages", "Continue run", or "View PR".
- Final summary card with fixed, skipped, flagged, and PR-ready sections.
- No free-form message composer during the main fix run.
- The composer appears only after the run enters Post-PR Refinement Mode.

Right panel, technical tabs:

- `Diff`: changed files, file-level summaries, and optionally a code diff viewer.
- `Console`: command timeline with command, exit code, duration, and output.
- `Logs`: raw normalized run events, audit events, sandbox lifecycle, and retry history.
- `Terminal`: terminal-style stream for install/build/typecheck output. This can be merged with `Console` in V1 if needed, but the UI should reserve the tab concept.

Default tab behavior:

- During editing, default to `Diff`.
- During install, build, typecheck, or failure, default to `Console` or `Terminal`.
- When a command fails, auto-expand the failed output and surface the related error card in the left timeline.
- When the agent edits files, add an edit card on the left and update the `Diff` tab on the right.
- When the run enters `awaiting_input`, keep the question in the left panel and keep technical tabs readable but secondary.

Agent timeline content:

- Chronological transcript.
- Agent status messages.
- Commands run.
- Terminal output.
- File changes.
- Build and typecheck attempts.
- Skipped checks.
- Flagged manual work.
- Awaiting-input blocks.
- PR creation event.
- Final run summary.

Technical workspace metadata:

- Phase timeline.
- Current run state.
- Target website.
- Connected repo and branch.
- Before score.
- Fix-plan buckets.
- Current blocker.
- Audit events.

Terminal output rules:

- Show command, exit status, and timestamp.
- Collapse long output by default.
- Expand failure output by default.
- Never expose secrets or tokens.
- Show customer-safe summaries rather than hidden reasoning.

File change rules:

- Show file path.
- Show one-line change reason.
- Show associated rubric check ID when available.
- Do not show raw source diffs in V1 unless explicitly added later.

## Post-PR Refinement Mode

Post-PR Refinement Mode opens after the agent creates a build-passing PR.

Purpose:

- Let the user react to the concrete PR.
- Let the user request small refinements.
- Let the agent push follow-up commits to the same PR branch.
- Keep the initial fix run bounded and predictable.

Entry rules:

- Opens only after a real PR exists.
- The PR must have passed build/typecheck before refinement begins.
- The refinement chat is scoped to the current project, run, PR, and branch.
- The UI should frame this as "Refine this PR", not as a generic AI chat.

Allowed user requests:

- Adjust wording the agent added.
- Revert or skip a specific generated addition.
- Change a selected MCQ decision while staying in the same approved scope.
- Fix a small issue introduced by the PR.
- Ask the agent to explain a specific change in the PR.
- Request a follow-up commit to the same PR branch.

Disallowed user requests:

- Build unrelated features.
- Rewrite product positioning broadly.
- Add new pages outside the approved Tier C scope.
- Work on a different repo or project.
- Convert the engagement into open-ended consulting.
- Ask for promises about traffic, rankings, or citations.

UI behavior:

- Left panel changes from read-only timeline to scoped chat.
- Existing transcript remains visible above the composer.
- The composer appears with scope copy such as "Refine this PR".
- The right panel keeps the same `Diff`, `Console`, `Logs`, and `Terminal` tabs.
- New refinement commits append as new edit cards in the left timeline.
- Failed refinement commands appear as error cards and expanded console output.
- The PR summary updates after each successful follow-up commit.

Execution rules:

- Refinements push follow-up commits to the same PR branch.
- Every refinement must run the same required build/typecheck verification before updating the PR.
- If a refinement fails verification, do not push it.
- All refinement events are stored in the same run transcript with a `refinement` phase marker.
- Refinement mode closes when the PR is merged, the user ends refinement, the run becomes stale, or the internal budget cap is reached.

Budget rules:

- Do not market a token amount to users.
- Internally cap refinement by request count, age, and cost.
- Suggested initial caps:
  - Starter: 1 refinement request.
  - Growth: 3 refinement requests.
  - Scale: 5 refinement requests.
  - Custom: configured per deal.
- A larger internal emergency token ceiling can exist, but it should not be user-facing.

## MCQ Intake

Collect most MCQ intake before run start inside `/fix-agent`.

Only ask questions required by the current fix plan.

Question types:

- single select
- multi select
- yes/no
- optional free-text note

Examples:

- Allow FAQ additions?
- Allow competitor comparison pages?
- Allow net-new blog content?
- Generate thumbnails for net-new content?
- What brand voice should the agent use?
- What claims should the agent avoid?
- Which competitors can be named?
- Which pricing facts can be stated?

Mid-run input:

- If the agent needs facts mid-run, set run state to `awaiting_input`.
- Render the question inline in the transcript.
- Allow only structured answers, with optional free-text notes where the question supports it.
- Resume the run after submit.

## Run States

Project-level next-action states:

- `checked`
- `github_required`
- `repo_confirmation_required`
- `unsupported`
- `checkout_required`
- `intake_required`
- `ready_to_run`
- `running`
- `awaiting_input`
- `pr_opened`
- `refinement_open`
- `refinement_closed`
- `merged`
- `recheck_available`
- `rechecked`
- `report_ready`
- `support_required`

Fix-run states:

- `queued`
- `cloning`
- `installing`
- `planning`
- `awaiting_input`
- `fixing`
- `verifying`
- `pr_opened`
- `refining`
- `refinement_closed`
- `merged`
- `failed`
- `stale`
- `no_changes_needed`

Repo-link states:

- `candidate`
- `confirmed`
- `rejected`
- `disconnected`

Order states:

- `quote_ready`
- `checkout_started`
- `paid`
- `failed`
- `support_review`

## Data Model Notes

Add or extend project-level models:

- `Project`
- `ProjectCheckup`
- `ProjectRun`
- `ProjectReport`
- `ReportExport`
- `RefinementMessage`
- `RefinementRequest`
- `TierCIntake`
- `RepoLink`
- `Order`
- `PullRequest`
- `AuditLog`
- `User.lastActiveProjectId`

Existing checkup reports remain source objects. The dashboard adds the project wrapper and workflow state around them.

Recommended ownership:

- `CheckupReport` stores the scan result.
- `Project` owns the user-facing workspace.
- `ProjectCheckup` links a project to one or more checkup reports.
- `RepoLink` stores repo-to-site evidence and user confirmation.
- `ProjectRun` or `FixRun` stores the agent run lifecycle.
- `RunEvent` stores refresh-safe transcript events.
- `ProjectReport` stores generated report metadata and source artifact links.
- `ReportExport` stores generated PDF/share artifacts, signed access tokens, revocation state, and expiry.
- `RefinementMessage` stores post-PR user/agent chat messages scoped to one run and PR.
- `RefinementRequest` stores each actionable refinement request, verification result, commit metadata, and budget usage.
- `TierCIntake` stores consent and facts for gated content work.
- `AuditLog` stores privileged actions visible to the user.

## API Notes

Add authenticated APIs for:

- dashboard summary
- active project selection
- scan import
- fix setup data
- MCQ intake submit
- fix-run creation
- run event polling or streaming
- refinement message send
- refinement request execution
- PR status
- re-check status
- report listing
- report generation
- report export/share-link creation
- GitHub install status
- billing/checkout state

Suggested route concepts:

- `GET /api/dashboard`
- `POST /api/projects/active`
- `POST /api/projects/from-checkup`
- `GET /api/fix-agent/setup`
- `POST /api/fix-agent/intake`
- `POST /api/fix-agent/runs`
- `GET /api/fix-agent/runs/:runId/events`
- `GET /api/fix-agent/runs/:runId/status`
- `POST /api/fix-agent/runs/:runId/refinement/messages`
- `POST /api/fix-agent/runs/:runId/refinement/requests`
- `POST /api/fix-agent/runs/:runId/refinement/end`
- `GET /api/reports`
- `GET /api/reports/:reportId`
- `POST /api/reports/:reportId/export`
- `POST /api/reports/:reportId/share-link`
- `DELETE /api/reports/:reportId/share-link`

## Analytics Events

Add typed PostHog events:

- `dashboard_viewed`
- `project_selected`
- `website_scan_started`
- `website_scan_completed`
- `website_scan_failed`
- `fix_setup_viewed`
- `intake_submitted`
- `fix_run_started`
- `fix_run_viewed`
- `fix_run_awaiting_input`
- `refinement_opened`
- `refinement_message_sent`
- `refinement_request_started`
- `refinement_request_completed`
- `refinement_closed`
- `pr_viewed`
- `reports_viewed`
- `report_downloaded`
- `report_share_link_created`
- `report_share_link_revoked`
- `support_opened`

Event naming stays `snake_case`.

Prefer reusable events with properties over route-specific duplicates.

Suggested properties:

- `project_id`
- `run_id`
- `website_type`
- `score`
- `pages_checked`
- `location`
- `state`
- `tier`
- `repo_connected`
- `payment_status`
- `report_id`
- `report_type`
- `export_type`
- `refinement_request_id`
- `refinement_status`

Do not send raw contact-form messages, secrets, repo contents, or source code to analytics.

## Test Plan

Active project:

- First login with no projects shows empty scan prompt.
- One project auto-selects.
- Multiple projects show selector.
- `?project=` selects a valid project.
- Invalid `?project=` is rejected.
- Server `lastActiveProjectId` works across devices.
- Local storage fallback works only when server state is unavailable or absent.

Website scan:

- Scan starts and shows progress.
- Scan completion creates or updates a project.
- Completed scan routes to `/fix-agent`.
- Unsupported website type routes to waitlist/contact instead of paid fix.
- Anonymous report-key handoff imports after auth.

Fix agent:

- No active project state.
- No scan state.
- Repo required state.
- Repo confirmation required state.
- Checkout required state.
- MCQ intake required state.
- Ready-to-start state.
- Running transcript state.
- Awaiting-input inline MCQ state.
- PR opened state.
- Post-PR refinement opens only after build-passing PR.
- Refinement composer is hidden before PR opened.
- Refinement request pushes to the same PR branch only after verification passes.
- Failed refinement does not push a commit.
- Refinement closes after merge, user end, stale run, or budget cap.
- Failed/support required state.
- No changes needed state.

Reports:

- No reports state.
- Latest scan report renders for active project.
- Fix summary report renders after PR opened or no-changes result.
- Before-after report renders only after re-check data exists.
- Download/export action creates a report export.
- Share-link action creates a signed, scoped link.
- Revoked share link stops access.
- Report deep link with `?report=` opens the correct report.
- Reports never expose raw source code, secrets, or full terminal logs.

Transcript:

- Events replay after refresh.
- `?run=` opens the correct run.
- Long terminal output collapses.
- Failed command output expands.
- Secret-like values are not rendered.

Return flows:

- GitHub callback returns to `dashboard.geo.repair`.
- Stripe checkout returns to `dashboard.geo.repair`.
- Support links can deep-link with `?project=` and `?run=`.

Verification:

- Confirm `apps/dashboard/dashboard-plan.md` exists.
- No build commands for this markdown-only planning change unless explicitly requested.
- No browser checks for this markdown-only planning change unless explicitly requested.
- No npm commands.

## Assumptions

- V1 dashboard implementation remains in `apps/web`.
- `apps/dashboard/` is used as a planning folder for now.
- The dashboard canonical origin is `dashboard.geo.repair`.
- Visible IA uses top-level routes, not `/p/[projectId]` or `/sites/[siteId]`.
- Runs are read-only agent transcript sessions inside `/fix-agent`.
- The fix agent can ask structured MCQ questions, but users cannot freely chat with it.
- Customer-facing copy uses "AI Search Optimization" and does not promise traffic, rankings, or citations.
