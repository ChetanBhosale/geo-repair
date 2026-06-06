# GEO Repair System Flow

This document is the source diagram for how GEO Repair works end to end. Keep
the flowchart and sequence diagram aligned with the real route handlers,
workflow activities, providers, and persistence models.

## Current System Shape

- Public website: `apps/web` on `geo.repair`.
- Authenticated dashboard: `apps/dashboard` on `dashboard.geo.repair`.
- Backend API: `apps/backend`, Express routes under `/api`.
- Job plane today: Temporal workflows and workers in `apps/backend/src/temporal`.
- Execution plane: E2B sandbox via `@repo/sandbox`, with the model/tool loop in
  `@repo/ai`.
- Persistence: Prisma models in `packages/db/prisma/schema.prisma`.
- Payments: Dodo one-time checkout, with webhooks as the payment source of
  truth and checkout-return reconciliation as a backup.

`plan/plan.md` still describes some future pieces. In these diagrams,
implementation paths are shown as current; future branches are explicitly
marked `planned`.

## Flowchart

```mermaid
flowchart TD
  Visitor["Visitor"]
  Marketing["geo.repair marketing site<br/>apps/web"]
  CheckupForm["Free AI Search readiness checkup<br/>apps/web/components/checkup/checkup-form.tsx"]
  WebProxy["Next route handlers<br/>apps/web/app/api/checkups/*"]
  BackendCheckup["Express checkup API<br/>POST /api/checkups<br/>GET /api/checkups/:workflowId/status<br/>GET /api/checkup-reports/:key"]
  TemporalCheckup["Temporal checkup workflow<br/>checkupWorkflow"]
  CheckupWorker["Checkup worker activity<br/>runCheckup"]
  TargetSite["Customer website<br/>robots, sitemap, pages, markdown twins"]
  Checker["Crawler and rubric scoring<br/>apps/backend/src/temporal/functions/checkup/crawler"]
  CheckupDB["CheckupRun, CheckupRunEvent,<br/>CheckupReport"]
  Result["Score, findings, page count,<br/>website type, quote tier"]
  Unsupported["Unsupported no-code platform<br/>waitlist or contact"]
  DownloadReport["Download scan report"]
  DashboardScan["dashboard.geo.repair /website-scan"]
  NeedRepo{"Repo selected?"}
  Settings["Dashboard /settings<br/>choose GitHub repo"]
  OAuth["GitHub OAuth<br/>/api/auth/github"]
  GitHub["GitHub API"]
  UserDB["User, Account, Repository"]
  RepoConfirmed["Repo and website confirmed"]
  CheckoutDialog["Tier checkout dialog<br/>Starter, Growth, Scale, custom"]
  BillingAPI["Billing API<br/>POST /api/billing/fix-checkout"]
  OrderDB["Order<br/>repoConfirmed, feasibilityPassed,<br/>tier, amount, status"]
  Dodo["Dodo hosted checkout"]
  DodoWebhook["Dodo webhook<br/>/api/webhooks/dodo"]
  ReturnPage["Checkout return page<br/>/checkout/return"]
  PaidOrder["Order PAID<br/>Start fix unlocked"]
  FixWorkspace["Dashboard /fix-agent"]
  StartFix["POST /api/fix<br/>requires auth, repo, paid matching order"]
  FixRunDB["FixRun, FixCheck, RunEvent"]
  TemporalFix["Temporal fixSiteWorkflow"]
  PlanRun["planRun<br/>fresh scan, build fix plan,<br/>persist checks"]
  Clarify{"Clarification needed?"}
  Intake["Structured MCQ intake<br/>POST /api/fix/:id/intake"]
  Sandbox["E2B sandbox<br/>clone repo, create fix branch"]
  Agent["@repo/ai agent loop<br/>OpenRouter model plus sandbox tools"]
  Commit{"Commit produced?"}
  PushPR["Push branch and open PR<br/>GitHub REST"]
  NoChanges["Completed with no changes<br/>show summary"]
  Failed["Failed or support required"]
  Teardown["Teardown sandbox<br/>record sandbox COGS"]
  PRReady["PR opened<br/>dashboard transcript and summary"]
  Reports["Reports API<br/>/api/reports/generate"]
  ProjectReports["ProjectReport and ReportShareLink"]
  MergeWebhook["GitHub merge webhook<br/>planned"]
  Recheck["Post-merge re-check<br/>planned"]

  Visitor --> Marketing --> CheckupForm --> WebProxy --> BackendCheckup
  BackendCheckup --> TemporalCheckup --> CheckupWorker
  CheckupWorker --> TargetSite --> Checker --> CheckupDB --> Result
  Result -->|"Framer, Webflow, Wix, WordPress, Shopify, unsupported"| Unsupported
  Result -->|"custom-coded site"| DownloadReport
  Result --> DashboardScan
  DashboardScan --> NeedRepo
  NeedRepo -->|"no"| Settings --> OAuth --> GitHub --> UserDB --> RepoConfirmed
  NeedRepo -->|"yes"| RepoConfirmed
  RepoConfirmed --> CheckoutDialog --> BillingAPI --> OrderDB --> Dodo
  Dodo --> DodoWebhook --> OrderDB
  Dodo --> ReturnPage --> OrderDB
  OrderDB --> PaidOrder --> FixWorkspace --> StartFix --> FixRunDB --> TemporalFix
  TemporalFix --> PlanRun --> Clarify
  Clarify -->|"yes"| Intake --> TemporalFix
  Clarify -->|"no"| Sandbox
  Intake --> Sandbox --> Agent --> Commit
  Commit -->|"yes"| PushPR --> PRReady
  Commit -->|"no"| NoChanges
  Agent -->|"error"| Failed
  PushPR -->|"error"| Failed
  PRReady --> Teardown
  NoChanges --> Teardown
  Failed --> Teardown
  PRReady --> Reports --> ProjectReports
  PRReady --> MergeWebhook --> Recheck --> Reports
```

## Sequence Diagram

```mermaid
sequenceDiagram
  actor User
  participant Web as geo.repair apps/web
  participant Dashboard as dashboard.geo.repair apps/dashboard
  participant API as apps/backend Express API
  participant Temporal as Temporal workflows
  participant Worker as Temporal workers
  participant Target as Customer website
  participant DB as Neon/Postgres via Prisma
  participant GitHub as GitHub
  participant Dodo as Dodo Payments
  participant E2B as E2B sandbox
  participant AI as OpenRouter model via @repo/ai

  User->>Web: Enter website URL
  Web->>API: POST /api/checkups
  API->>DB: Create CheckupRun
  API->>Temporal: Start checkupWorkflow
  API-->>Web: workflowId

  loop Poll progress
    Web->>API: GET /api/checkups/:workflowId/status
    API->>Temporal: Describe/result workflow
    API->>DB: Read CheckupRun progress/events
    API-->>Web: Progress or completed result key
  end

  Temporal->>Worker: runCheckup
  Worker->>Target: Fetch pages, robots, sitemap, twins
  Worker->>Worker: Crawl and score rubric findings
  Worker->>DB: Save CheckupReport and progress events
  Worker-->>Temporal: CheckupResult
  Web->>API: GET /api/checkup-reports/:key
  API->>DB: Load saved report
  API-->>Web: Score, findings, website type, page count

  alt Unsupported platform
    Web-->>User: Show waitlist/contact path
  else Custom-coded site
    Web-->>User: Show score, quote, report download, fix CTA
  end

  User->>Dashboard: Continue to dashboard/fix flow
  alt Not authenticated
    Dashboard->>API: GET /api/auth/github
    API->>GitHub: OAuth authorization and token exchange
    GitHub-->>API: GitHub profile and token
    API->>DB: Upsert User and Account
    API-->>Dashboard: Set auth cookie, redirect
  end

  Dashboard->>API: GET /api/github/repos
  API->>GitHub: List accessible repos
  GitHub-->>API: Repos
  API-->>Dashboard: Repo list
  User->>Dashboard: Select repo and bind website
  Dashboard->>API: POST /api/github/repos/select or PATCH /api/github/repos/:id/website
  API->>DB: Save Repository

  User->>Dashboard: Choose fix tier
  Dashboard->>API: POST /api/billing/fix-checkout
  API->>DB: Create or reuse Order scoped to report and repo
  API->>Dodo: Create checkout session
  Dodo-->>API: checkoutUrl, session/payment ids
  API->>DB: Mark order CHECKOUT_CREATED
  API-->>Dashboard: checkoutUrl
  Dashboard-->>User: Redirect to Dodo checkout

  User->>Dodo: Pay
  Dodo-->>Web: Return to /checkout/return
  par Source of truth webhook
    Dodo->>API: POST /api/webhooks/dodo with raw signed body
    API->>DB: Store PaymentWebhookEvent and update Order
  and Return-page reconciliation
    Web->>API: POST /api/billing/orders/:id/reconcile when payment_id exists
    API->>Dodo: Retrieve payment
    API->>DB: Update Order if verified
  end
  Web->>API: GET /api/billing/orders/:id
  API->>DB: Read order status
  API-->>Web: PAID unlock state
  Web-->>User: Start fix link to dashboard

  User->>Dashboard: Start fix
  Dashboard->>API: POST /api/fix with website, repositoryId, orderId
  API->>DB: Verify paid order matches user, repo, website
  API->>DB: Create FixRun
  API->>Temporal: Start fixSiteWorkflow
  API-->>Dashboard: fixRunId, temporalWorkflowId

  Temporal->>Worker: planRun
  Worker->>Target: Fresh checkSite scan
  Worker->>DB: Upsert FixCheck rows and RunEvent transcript
  alt Clarification required
    Worker->>DB: Write agent_clarification_requested event
    Dashboard->>API: GET /api/fix/:fixRunId
    API->>DB: Read detail and events
    API-->>Dashboard: Clarification questions
    User->>Dashboard: Submit MCQ answers
    Dashboard->>API: POST /api/fix/:fixRunId/intake
    API->>DB: Persist intake
    API->>Temporal: Signal submitFixIntake
  end

  Temporal->>Worker: prepareSandbox
  Worker->>E2B: Create or reconnect sandbox
  Worker->>GitHub: Mint/resolve repo token
  Worker->>E2B: Clone repo and checkout geo-repair fix branch
  Worker->>DB: Update sandbox state and RunEvents

  Temporal->>Worker: runHarness
  Worker->>AI: Send prompt, failing checks, skills, intake
  loop Agent tool loop
    AI->>Worker: Tool call
    Worker->>E2B: Read, write, run commands in repo
    E2B-->>Worker: Tool result
    Worker->>DB: Append RunEvent
    Worker-->>AI: Tool result
  end
  Worker->>E2B: Check commit and collect diff summary
  Worker->>DB: Update FixCheck counters and COGS

  Temporal->>Worker: finalizeRun
  alt Commit exists
    Worker->>GitHub: Push branch and open pull request
    GitHub-->>Worker: PR URL and number
    Worker->>DB: Mark PR_OPENED and append pr_opened event
  else No commit
    Worker->>DB: Mark COMPLETED and append no_changes event
  end

  Temporal->>Worker: teardownSandbox
  Worker->>E2B: Kill sandbox
  Worker->>DB: Record sandbox seconds and cost

  loop Dashboard polling
    Dashboard->>API: GET /api/fix-runs and GET /api/fix/:fixRunId
    API->>DB: Read FixRun, FixCheck, RunEvent
    API-->>Dashboard: Transcript, PR, checks, costs-safe status
  end

  User->>Dashboard: Generate or share report
  Dashboard->>API: POST /api/reports/generate or share link routes
  API->>DB: Generate ProjectReport and ReportShareLink
  API-->>Dashboard: Report artifact

  opt Planned post-merge loop
    GitHub->>API: Pull request merged webhook
    API->>Temporal: Start re-check
    Temporal->>Worker: Run updated checkup
    Worker->>DB: Save before-after report data
    Dashboard->>API: GET /api/reports
    API-->>Dashboard: Readiness delta report
  end
```

## Maintenance Rule

Update this file in the same change whenever any of these move:

- A public or dashboard route changes the user journey.
- An Express API route is added, removed, renamed, or changes ownership.
- Auth, GitHub, billing, webhook, or checkout behavior changes.
- A Temporal workflow, activity, signal, task queue, or fix-run state changes.
- E2B sandbox setup, agent execution, PR opening, or teardown behavior changes.
- Prisma models that store checkups, orders, fix runs, events, reports, or
  shares change in a way users or operators need to understand.
- Planned behavior becomes shipped behavior, especially GitHub merge webhooks,
  post-merge re-checks, or future monitoring.

If a code change touches one of those areas and the diagrams do not need a
change, say that explicitly in the PR notes.

## Source Files To Check Before Editing

- `AGENTS.md`
- `plan/plan.md`
- `apps/dashboard/dashboard-plan.md`
- `apps/backend/index.ts`
- `apps/backend/src/checkup`
- `apps/backend/src/billing`
- `apps/backend/src/auth`
- `apps/backend/src/github`
- `apps/backend/src/fix`
- `apps/backend/src/reports`
- `apps/backend/src/temporal`
- `apps/web/app/api`
- `apps/web/components/checkup/checkup-form.tsx`
- `apps/dashboard/app/website-scan/page.tsx`
- `apps/dashboard/app/fix-agent/page.tsx`
- `packages/db/prisma/schema.prisma`
- `packages/ai`
- `packages/sandbox`
