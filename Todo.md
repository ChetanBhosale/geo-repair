
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
