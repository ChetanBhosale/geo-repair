---
title: "Privacy Policy · GEO Repair"
description: "How GEO Repair handles your data: your code lives only in an ephemeral sandbox, is never retained after a run, and is never used to train models."
source: https://geo.repair/privacy
---

# Privacy Policy

_Last updated June 4, 2026_

This Privacy Policy explains what GEO Repair collects, how we use it, and, just as importantly, what we never do with it. The short version: your code lives only inside an ephemeral sandbox for a single run, is never retained afterward, and is never used to train models.

## Our core commitments

- **Zero data retention.** We clone the one repository you pick into an ephemeral sandbox, make the fixes, open the pull request, and destroy the sandbox and the clone. Nothing about your code persists on our side.
- **No model training.** Your code is never used to train, fine-tune, or evaluate models. It is read only to make the specific fixes you approved.
- **Least privilege.** We request access to the single repository you select, never your other repositories, organization, or account-wide permissions.
- **No third-party sharing.** We don't sell or share your source code, and we don't pass it to third-party services beyond what's strictly needed to open your pull request.

## What we collect

### The free checkup

The checkup fetches your public pages, the same way an AI crawler would, and respects your robots.txt. It never touches your repository. We store the URL you checked and the resulting readiness score so you can revisit your report.

### Account information

If you create an account, we collect your email address and authentication details from your identity provider. If you buy an AI Search Fix, Dodo Payments handles your card details, and we never see or store full card numbers.

### Waitlist and contact forms

If you join the waitlist or submit the contact form, we collect the information you provide, such as your email address, name, and message. We use Resend to send waitlist confirmations, contact acknowledgements, and internal contact-form notifications.

### Repository data during a fix run

When you approve a fix, your repository is cloned into an ephemeral sandbox solely for that run. The agent reads only what it needs to edit the flagged checks. When the run ends, the sandbox and clone are destroyed.

### Usage analytics

We use privacy-respecting product analytics to understand how the Service is used in aggregate. This does not include your source code.

## How we use information

- To run the checkup and return your readiness report.
- To open the pull requests you approve and re-check readiness afterward.
- To operate, secure, and improve the Service.
- To communicate with you about your account, support requests, and service changes.

## Service providers

We use carefully selected service providers to operate the Service, including hosting, analytics, payments through Dodo Payments, authentication, repository access, and transactional email through Resend. These providers process information only as needed to provide their services to us. We do not sell personal information.

## Data retention

Source code is never retained beyond the lifetime of a single sandboxed run. Account information is kept while your account is active and deleted on request. Waitlist and contact-form information is kept as long as needed to respond to you and operate the Service. Checkup results and aggregate analytics are kept to provide the Service and may be retained in de-identified form.

## Your rights

You can request access to, correction of, or deletion of your account information at any time by emailing privacy@geo.repair. Disconnecting a repository immediately revokes our access to it.

## Changes to this policy

We may update this policy from time to time. Material changes will be reflected by the "last updated" date above.

## Contact

Questions about your privacy? Email privacy@geo.repair, or read more on our [Security](https://geo.repair/security) page.

---

_Markdown copy of [Privacy Policy · GEO Repair](https://geo.repair/privacy), a faithful text version of the page for machines and readers. © GEO Repair._
