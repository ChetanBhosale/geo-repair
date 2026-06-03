# Scaling the fix-site run with Temporal

How to fix many pages (e.g. 200) in one run without losing progress, blowing
LLM context, or overflowing Temporal history, then open a single PR at the end.

## The mental model

Split responsibilities cleanly:

- **Workflow = the brain / source of truth for progress.** Holds the durable
  list of all pages and each one's status (`pending | fixing | fixed | failed |
  skipped`). Answers "what's been done" and survives any crash. Does NO work
  itself.
- **Activities = the hands.** Each does one unit of real work (create sandbox,
  clone, fix one page, build, open PR). Stateless and retryable.
- **Sandbox + git branch = where the actual file changes live.** Not in
  Temporal. The clone, edits, and commits live in the E2B sandbox / working
  tree, referenced by a `sandboxId`.

So Temporal tracks *orchestration state*; git tracks *file state*; the agent
only ever sees *one page*.

## The flow

```
FixSiteWorkflow(runId, repo, pages[])
  1. sandboxId = createSandbox()          activity
  2. cloneAndInstall(sandboxId, repo)     activity → branch "geo-fix/<runId>"
  3. for each page in pages:              loop in the workflow
       fixOnePage(sandboxId, page)        activity (agent edits + commits that page)
       update workflow state: page.status = fixed/failed
  4. buildAndTypecheck(sandboxId)         activity (loops back to fixing on failure)
  5. openPR(sandboxId, branch)            activity → ONE PR with all commits
  6. destroySandbox(sandboxId)            activity (in cleanup/finally)
```

The loop is a normal `for` loop in the workflow. After each `fixOnePage`
returns, the workflow updates its in-memory state (`pages[i].status = "fixed"`).
Because Temporal **persists every activity result and replays
deterministically**, that state is durable: if the worker dies at page 137, on
restart Temporal replays history, sees pages 1-136 already completed, and
resumes at 137. Finished pages are never redone and progress is never lost.

## The three things you must design around

### 1. Context (the LLM) — solved by scoping per page

Each `fixOnePage` activity spins a **fresh agent invocation** with bounded
input: just that page's failing checks + the file(s) that render it + the fix
hints. The agent never holds all pages in context. The workflow holds the
*index* of all pages; the agent holds *one*. This keeps every agent call small
and cheap, and it is the cost control (Opus only touches flagged files).

### 2. Temporal history growth — solved by continue-as-new

Every activity adds events to the workflow's history. Temporal warns at ~10k
events and hard-caps at ~50k. 200 pages x (schedule + start + complete +
heartbeats + retries) can approach that. The fix is **Continue-As-New**: every
N pages (e.g. 50), the workflow restarts itself, passing forward
`{ remainingPages, sandboxId, branch, completedSummary }`. Same logical run,
fresh empty history. The sandbox and branch survive because they are external
(referenced by id), not stored in history.

### 3. The sandbox is stateful, activities are not — the key decision

Activities can run on different workers and the sandbox must outlive any single
one. Two viable shapes:

- **(A) Persistent sandbox, activities reconnect by id.** `createSandbox`
  returns `sandboxId`; each `fixOnePage` connects to that sandbox, edits,
  commits, disconnects. Pro: clean per-page retry + durability. Con: must keep
  the sandbox alive (idle-timeout / keep-alive) for the whole run and clean it
  up reliably.
- **(B) Batched fix session.** One activity holds the sandbox and loops over a
  *batch* of pages internally, emitting a **heartbeat per page**
  (`heartbeat({ page: 42, status })`). Pro: simpler sandbox lifetime, fewer
  events. Con: coarser retry granularity (a crash retries the whole batch,
  though heartbeat details let you resume mid-batch).

A **hybrid** is best: persistent sandbox (A) for lifetime, pages processed in
**batches** to keep history small, with **continue-as-new** between batches.
Heartbeats give the live "fixing page 42/200" progress for the UI.

## Two details that bite you

- **Idempotency.** `fixOnePage` must be safe to retry. If retried after already
  editing, it must not double-apply. Have it check current file state, or
  commit-per-page with a deterministic marker so a retry sees "already done" and
  no-ops.
- **Commit incrementally.** Commit each page (or batch) into the branch as you
  go. Then even across continue-as-new or worker restarts, the *real work* is
  durable in git, not just in workflow state. At the end, `openPR` once on the
  accumulated branch.

## Push back: most fixes are NOT per-page

"All 200 pages have issues, fix each page" is usually wrong. Most GEO/AEO fixes
are **shared**: `sitemap`, `robots`, `llms.txt`, the layout/`<head>` template, a
shared SEO component, fixing those once repairs the same check across all 200
pages. Before fanning out 200 agent calls, the workflow should **group failing
checks**:

- **Site-wide fixes** (one activity each): sitemap, robots, llms.txt, shared
  head/layout/components.
- **Genuinely per-page content fixes** (the fan-out): answerability,
  definitions, per-page content gaps.

That turns "200 expensive agent runs" into maybe "5 site-wide fixes + a handful
of real per-page edits", dramatically cheaper and faster, and matches how the
rubric maps to a codebase.

## Summary

The workflow holds the durable per-page progress, each page is a small scoped
activity (fresh agent context), batch + continue-as-new keeps history bounded,
the sandbox/branch holds the file state across it all, and one PR is opened at
the very end.

## Worker deployment, concurrency, and autoscaling

### Where things run

- **Temporal Cloud** = orchestration only (queues, history, timers, retries,
  task distribution). Hosted for you. It never runs your code.
- **Workers** = your `bun run worker` process. They run on YOUR compute (your
  laptop in dev, your EC2/containers in prod). All the real work (scraping,
  parsing, the fix agent) and all in-process concurrency happen here, not on
  Temporal Cloud.
- **E2B** = disposable microVMs in E2B's cloud where the fix agent actually
  edits code. The fix worker box stays light; it just launches sandboxes.

### What Temporal handles vs what you handle

| Concern | Who |
|---|---|
| Distributing tasks across workers | Temporal (automatic) |
| No double-processing / exactly-once task handoff | Temporal (automatic) |
| Retrying work when a worker dies mid-task | Temporal (automatic) |
| Buffering tasks when no worker is up | Temporal (automatic) |
| Concurrency inside one worker (activity slots) | You (worker config) |
| Restarting the crashed OS process | A process manager (PM2/systemd/container) |

Temporal makes the *work* durable; it does NOT keep your *process* alive.

### Process management

- On bare EC2: use **PM2 (plain fork mode) or systemd** to keep workers alive
  and restart on crash/reboot (`pm2 startup` + `pm2 save`).
- Do **NOT** use `pm2 start -i max` (cluster mode). Cluster mode load-balances
  incoming sockets for HTTP servers; a Temporal worker pulls from the queue and
  has nothing to balance, and it doesn't play well with Bun + the Temporal core.
  To add capacity, start **more separate worker processes**, Temporal
  load-balances across them automatically.
- In Docker/ECS/Fly/K8s: drop PM2, let the platform's restart policy handle it.
- Run API, scrape-worker, and fix-worker as **separate processes** so a worker
  OOM never takes down the API. Set a memory-restart cap on small boxes.

### Instance sizing reality (e.g. t3.small)

- t3 is **burstable**: ~20% sustained baseline on CPU credits, throttled when
  credits run out. 2 GB RAM is the first thing to run out.
- The SDK default `maxConcurrentActivityTaskExecutions: 100` is dangerous on a
  small box, it will accept 100 audits, OOM, and crash-loop. **Cap it to match
  the box** (scrape ~2-4 full-site audits on a t3.small).
- Scale by **adding boxes**, not by cranking concurrency on one small box.
  Per-worker concurrency and instance count are complementary throttles.

### Autoscaling (recommended)

Yes, autoscale workers, but with **two separate Auto Scaling Groups**, one per
queue, because scrape and fix scale on completely different constraints:

- **Scrape workers**: CPU/memory bound, cheap. Can scale freely/aggressively.
- **Fix workers**: the EC2 box is light (work runs in E2B), but each fix = a
  sandbox + Opus + real money. Scale **conservatively**, the true ceiling is
  **E2B sandbox quota + budget**, not EC2 CPU. Often a controlled drain, not
  aggressive scale-out.

Autoscaling design notes:

- **Scale on queue backlog / schedule-to-start latency, NOT CPU.** CPU reacts
  after the box is already melting and is muddy on burstable instances. Publish
  Temporal's task-queue backlog as a custom CloudWatch metric and scale the ASG
  on it. (On K8s, KEDA has a native Temporal scaler that scales pods on task
  queue backlog with no custom plumbing.)
- **Graceful drain on scale-in.** Handle SIGTERM: stop polling for new tasks,
  let in-flight tasks finish via `worker.shutdown()`, then exit. Use ASG
  lifecycle hooks + a drain timeout so AWS waits, otherwise scale-in interrupts
  a fix mid-run (Temporal retries it, but you waste the sandbox + money).
- **Fast cold start.** Bake an AMI / container image with deps pre-installed so
  new workers poll in seconds, not minutes. Keep a small warm baseline (1-2
  always-on) so the first users never wait for a scale-up.
- Workers self-register by just polling (no LB, no service discovery); dead
  ones are handled by Temporal reschedule. This is why ASG-of-workers is a
  natural fit.

## Target production architecture

```
        ┌──────────────┐        starts workflows / polls status
client →│  Backend API │ ─────────────────────────────────────┐
        │  (EC2)       │                                       │
        └──────────────┘                                       ▼
                                                      ┌──────────────────┐
                                                      │  Temporal Cloud  │
                                                      │  queues, state,  │
                                                      │  retries, distro │
                                                      └──────────────────┘
                                                          ▲          ▲
                                          pull scrape ────┘          └──── pull fix
                                                   │                      │
                                          ┌────────────────┐    ┌────────────────┐
                                          │ Scrape workers │    │  Fix workers   │
                                          │   ASG (scale   │    │  ASG (scale    │
                                          │  on backlog)   │    │  conservative) │
                                          └────────────────┘    └───────┬────────┘
                                                                        │ launches
                                                                        ▼
                                                                 ┌────────────┐
                                                                 │ E2B microVM│
                                                                 └────────────┘
```

- **Backend API (EC2):** receives requests, starts workflows (pushes to the
  queue), polls status. Light, steady load.
- **Temporal Cloud:** holds queues + state, retries, distributes tasks.
- **Worker ASGs:** pull from the queues, do the work, scale on queue backlog.

This shape is correct. Lock in three things:

1. **Two ASGs, not one** — separate scrape-worker and fix-worker groups; they
   scale on different constraints (fix is gated by E2B quota + budget).
2. **Put the backend API behind its own ASG (or at least make it replaceable),
   ideally an ALB.** A single API box is a single point of failure. Even min=1
   in an ASG gives auto-restart + zero-downtime replacement; add an ALB for HA.
3. **Scale workers on queue backlog, not CPU**, and handle graceful drain on
   scale-in (SIGTERM → `worker.shutdown()` → exit, with ASG lifecycle hooks).

Upgrade over a literal single backend box: don't leave the API as one instance
long-term, wrap it in an ASG/ALB so it's resilient, not just the workers.
