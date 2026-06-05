---
title: "One repo, in a sandbox, then gone"
description: "GEO Repair is built to need as little of your trust as possible. Here's exactly what we touch, what we never touch, and what happens to your code."
source: https://geo.repair/security
---

# One repo, in a sandbox, then gone

GEO Repair is built to need as little of your trust as possible. Here's exactly what we touch, what we never touch, and what happens to your code.

## Four promises we design around

- **Your code is never kept.** We clone your repository into an ephemeral sandbox, make the fixes, open the pull request, and destroy the sandbox. Nothing persists after the run.
- **Only the one repo you pick is touched.** Least-privilege by design. We request access to a single repository, the one you choose, and never the rest of your account or organization.
- **No confidential data leaves to third parties.** Your source stays inside the run. We don't sell it, share it, or pass it to third-party services beyond what's needed to open your pull request.
- **Zero data retention, no model training.** Your code is never used to train models and is not retained after the sandbox is destroyed. Readiness is measured, the fix is shipped, and nothing is stored.

## What we access, and what we don't

We ask for the narrowest access that lets us open a useful pull request, and nothing more.

- Yes: The one public site you check (free checkup)
- Yes: The single repository you explicitly select
- Yes: An ephemeral sandbox that's destroyed after the run
- Never: Your other repositories or your whole account
- Never: Your code, retained after the pull request opens
- Never: Your code, used to train models

## What happens during a fix run

Every run is isolated and short-lived. Here's the full lifecycle, start to finish.

### 01 · Provision

When you approve a fix, we spin up a fresh, isolated sandbox scoped to the single repository you picked.

### 02 · Clone & fix

The repo is cloned into the sandbox. The agent edits only the checks it flagged, then runs the build and type-check to verify nothing broke.

### 03 · Open the PR

The agent pushes a branch and opens a pull request for your review. You decide what merges.

### 04 · Destroy

The sandbox and its clone are torn down. Nothing about your code persists on our side.

## Core Concepts & Definitions

- **Ephemeral Sandbox**: An isolated, temporary container provisioned purely for executing your fix agent run, which is completely destroyed immediately post-PR.
- **Zero Data Retention**: Our strict architectural policy where we never store, log, cache, or retain your private source code after the execution sandbox is deleted.

## Technical Standards & Authority Sourcing

- [OWASP Top Ten Security Risks Guidance](https://owasp.org/www-project-top-ten/) (OWASP Foundation)
- [GitHub Developer OAuth & App Security Standards](https://docs.github.com/en/apps/maintaining-github-apps/evaluating-a-github-app-security-report) (GitHub Docs)

## Security questions

### Do you store my source code?

No. Your code lives only inside an ephemeral sandbox for the duration of a single run. Once the pull request is opened, the sandbox and the clone are destroyed and nothing is retained.

### Do you train AI models on my code?

No. Your code is never used to train models. It is read to make the specific fixes you approved and for nothing else.

### What access do you request on my repository?

Least-privilege, single-repository access. We request access to the one repository you select, never your other repositories, organization, or account-wide permissions.

### Does the free checkup touch my code at all?

No. The free checkup only fetches your public pages, the same way an AI crawler would, and respects your robots.txt. It never touches your repository; that only happens if you approve a fix run.

---

_Markdown copy of [One repo, in a sandbox, then gone](https://geo.repair/security), a faithful text version of the page for machines and readers. © GEO Repair._
