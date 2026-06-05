import "server-only"
import { promises as fs } from "node:fs"
import path from "node:path"

import { SITE } from "./seo"
import {
  HOME_CONTENT,
  CHECKER_CONTENT,
  HOW_IT_WORKS_INTRO,
  HOW_IT_WORKS_STEPS,
  LANDING_FEATURES,
  type LandingContent,
  type FaqItem,
} from "./landing-content"
import { CATEGORY_META, CATEGORIES_INTRO } from "./rubric-meta"
import { TRUST_PROMISES, TRUST_TAGLINE } from "./trust"
import {
  PRICING_HEADER,
  PRICING_FREE,
  FIX_TIERS_INTRO,
  FIX_TIERS,
  FIX_INCLUDES,
  PRICING_FOOTNOTE,
  PRICING_FAQ_INTRO,
  PRICING_FAQ,
  type PricingTier,
  SECURITY_HEADER,
  SECURITY_COMMITMENTS_INTRO,
  SECURITY_ACCESS_INTRO,
  SECURITY_LIFECYCLE_INTRO,
  SECURITY_ACCESS,
  SECURITY_LIFECYCLE,
  SECURITY_FAQ_INTRO,
  SECURITY_FAQ,
  CONTACT_HEADER,
  CONTACT_CHANNELS,
} from "./marketing-content"
import { getAllPosts, getPostBySlug } from "./blog"
export { MARKDOWN_TWIN_PATHS, markdownTwinPath } from "./twin-paths"

// Markdown "twins": a faithful, machine-readable copy of each primary page,
// served as text/markdown at <path>.md. Every twin is built from the SAME
// content source the HTML page renders from (lib/landing-content,
// lib/marketing-content, the rubric meta, and the blog MDX), so the two never
// drift. No new claims are introduced here, this is a reformat, not authoring.
// See RUBRIC.md -> `markdown-twins` (Tier B).

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}

function faqMarkdown(items: FaqItem[]): string {
  return items.map((i) => `### ${i.question}\n\n${i.answer}`).join("\n\n")
}

// Wraps a body in lightweight YAML front matter + a provenance footer so a model
// always knows the canonical source and that this is a derived copy.
function doc(opts: {
  title: string
  description: string
  canonicalPath: string
  body: string
}): string {
  const url = new URL(opts.canonicalPath, SITE.url).toString()
  return [
    "---",
    `title: ${JSON.stringify(opts.title)}`,
    `description: ${JSON.stringify(opts.description)}`,
    `source: ${url}`,
    "---",
    "",
    opts.body.trim(),
    "",
    "---",
    "",
    `_Markdown copy of [${opts.title}](${url}), a faithful, machine-readable version of the page. © ${SITE.name}._`,
    "",
  ].join("\n")
}

// The full landing page (home and /geo-aeo-checker share the same layout; only
// the hero and FAQ differ), reformatted from its content source.
function landingTwin(content: LandingContent): string {
  const heroTitle = `${content.headline} ${content.headlineAccent}${
    content.headlineTail ?? ""
  }`
    .replace(/\s+/g, " ")
    .trim()

  const sections: string[] = [
    `# ${heroTitle}`,
    "",
    content.subhead,
    "",
    `## ${HOW_IT_WORKS_INTRO.title}`,
    "",
    HOW_IT_WORKS_INTRO.description ?? "",
    "",
    HOW_IT_WORKS_STEPS.map((s) => `### ${s.n} · ${s.title}\n\n${s.body}`).join(
      "\n\n"
    ),
    "",
    `## ${CATEGORIES_INTRO.title}`,
    "",
    CATEGORIES_INTRO.description,
    "",
    CATEGORY_META.map(
      (c) =>
        `- **${c.category}** (${c.checkCount} ${
          c.checkCount === 1 ? "check" : "checks"
        }): ${c.description}`
    ).join("\n"),
    "",
    LANDING_FEATURES.map(
      (f) =>
        `## ${f.title}\n\n${f.description}\n\n${f.points
          .map((p) => `- ${p}`)
          .join("\n")}`
    ).join("\n\n"),
    "",
    "## Security & trust",
    "",
    TRUST_TAGLINE,
    "",
    TRUST_PROMISES.map((p) => `- **${p.title}.** ${p.body}`).join("\n"),
    "",
    "## Frequently asked questions",
    "",
    faqMarkdown(content.faq),
  ]

  return doc({
    title: content.metaTitle,
    description: content.metaDescription,
    canonicalPath: content.path,
    body: sections.join("\n"),
  })
}

function planMarkdown(tier: PricingTier): string {
  const price = `${tier.price}${tier.cadence ?? ""}`
  return [
    `**${tier.name}: ${price}**`,
    "",
    tier.blurb,
    "",
    tier.features.map((f) => `- ${f}`).join("\n"),
    tier.note ? `\n_${tier.note}_` : "",
  ].join("\n")
}

function pricingTwin(): string {
  const fixTiers = FIX_TIERS.map(
    (t) => `- **${t.name}** (${t.pages}): ${t.price}`
  ).join("\n")

  const body = [
    `# ${PRICING_HEADER.title}`,
    "",
    PRICING_HEADER.description ?? "",
    "",
    "## Step 1 · Start with the free checkup",
    "",
    planMarkdown(PRICING_FREE),
    "",
    `## ${FIX_TIERS_INTRO.title}`,
    "",
    FIX_TIERS_INTRO.description ?? "",
    "",
    fixTiers,
    "",
    "**Every fix includes**",
    "",
    FIX_INCLUDES.map((f) => `- ${f}`).join("\n"),
    "",
    PRICING_FOOTNOTE,
    "",
    `## ${PRICING_FAQ_INTRO.title}`,
    "",
    faqMarkdown(PRICING_FAQ),
  ].join("\n")

  return doc({
    title: PRICING_HEADER.title,
    description: PRICING_HEADER.description ?? "",
    canonicalPath: "/pricing",
    body,
  })
}

function securityTwin(): string {
  const access = SECURITY_ACCESS.map(
    (a) => `- ${a.allowed ? "Yes" : "Never"}: ${a.label}`
  ).join("\n")

  const lifecycle = SECURITY_LIFECYCLE.map(
    (s, i) => `### 0${i + 1} · ${s.title}\n\n${s.body}`
  ).join("\n\n")

  const body = [
    `# ${SECURITY_HEADER.title}`,
    "",
    SECURITY_HEADER.description ?? "",
    "",
    `## ${SECURITY_COMMITMENTS_INTRO.title}`,
    "",
    TRUST_PROMISES.map((p) => `- **${p.title}.** ${p.body}`).join("\n"),
    "",
    `## ${SECURITY_ACCESS_INTRO.title}`,
    "",
    SECURITY_ACCESS_INTRO.description ?? "",
    "",
    access,
    "",
    `## ${SECURITY_LIFECYCLE_INTRO.title}`,
    "",
    SECURITY_LIFECYCLE_INTRO.description ?? "",
    "",
    lifecycle,
    "",
    `## ${SECURITY_FAQ_INTRO.title}`,
    "",
    faqMarkdown(SECURITY_FAQ),
  ].join("\n")

  return doc({
    title: SECURITY_HEADER.title,
    description: SECURITY_HEADER.description ?? "",
    canonicalPath: "/security",
    body,
  })
}

function contactTwin(): string {
  const channels = CONTACT_CHANNELS.map(
    (c) => `- **${c.label}**: [${c.value}](${c.href}): ${c.body}`
  ).join("\n")

  const body = [
    `# ${CONTACT_HEADER.title}`,
    "",
    CONTACT_HEADER.description ?? "",
    "",
    "## Contact channels",
    "",
    channels,
  ].join("\n")

  return doc({
    title: CONTACT_HEADER.title,
    description: CONTACT_HEADER.description ?? "",
    canonicalPath: "/contact",
    body,
  })
}

function blogIndexTwin(): string {
  const posts = getAllPosts()
  const list = posts
    .map((p) => {
      const url = new URL(`/blog/${p.slug}`, SITE.url).toString()
      return `## [${p.title}](${url})\n\n${formatDate(p.date)} · ${p.tags.join(
        ", "
      )}\n\n${p.description}`
    })
    .join("\n\n")

  const body = [
    "# Notes on AI Search Optimization",
    "",
    "Honest, technical guides to making your site legible to AI search engines: no hype, no citation guarantees, just what's in your control.",
    "",
    list,
  ].join("\n")

  return doc({
    title: "Blog · AI Search Optimization Guides · GEO Repair",
    description:
      "Plain-English guides to AI Search Optimization: how AI crawlers read your site, which technical checks matter, and how to make pages legible to ChatGPT, Perplexity, and AI Overviews.",
    canonicalPath: "/blog",
    body,
  })
}

// Blog posts are authored in Markdown (MDX), so the raw file IS the faithful
// twin. We read it directly and strip any import/export lines (none today, but
// MDX permits them) so the output is pure Markdown. The content/ directory is
// pinned into this route's serverless bundle via outputFileTracingIncludes.
async function blogPostTwin(slug: string): Promise<string | null> {
  const post = getPostBySlug(slug)
  if (!post) return null

  let raw: string
  try {
    raw = await fs.readFile(
      path.join(process.cwd(), "content", "blog", `${slug}.mdx`),
      "utf8"
    )
  } catch {
    return null
  }

  const prose = raw.replace(/^\s*(import|export)\s.*$/gm, "").trim()
  const meta = `**${formatDate(post.date)}** · ${post.tags.join(
    ", "
  )} · By ${post.author}`

  const body = [
    `# ${post.title}`,
    "",
    `> ${post.description}`,
    "",
    meta,
    "",
    prose,
  ].join("\n")

  return doc({
    title: post.title,
    description: post.description,
    canonicalPath: `/blog/${slug}`,
    body,
  })
}

// --- Legal pages -----------------------------------------------------------
// The prose lives as styled JSX in the page components; these are faithful
// Markdown transcriptions of that exact copy (point-in-time, update alongside
// the page when the legal text changes). Low-churn, so duplication is the
// pragmatic choice over rendering both from one Markdown source.

const PRIVACY_BODY = `# Privacy Policy

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

Questions about your privacy? Email privacy@geo.repair, or read more on our [Security](${new URL(
  "/security",
  SITE.url
).toString()}) page.`

const TERMS_BODY = `# Terms of Service

_Last updated June 4, 2026_

These Terms of Service ("Terms") govern your access to and use of GEO Repair (the "Service"), including the free readiness checkup and the AI fix agent. By using the Service you agree to these Terms. If you do not agree, do not use the Service.

## The Service

GEO Repair runs a readiness checkup that fetches your public web pages (the same way an AI crawler would) and scores how ready they are for AI search engines to read and cite. If you connect a repository, the AI fix agent edits the checks it flagged in an ephemeral sandbox and opens a pull request for your review.

## What we do not promise

The Service measures and improves technical readiness. We do **not** promise increased traffic, higher rankings, or that any AI system will cite your site. Those outcomes depend on factors outside our control. Any score, estimate, or recommendation is provided for guidance and is not a guarantee of any result.

## Your account and repository access

- You must provide accurate information and are responsible for activity under your account.
- When you connect a repository, you grant us least-privilege access to the single repository you select, never your other repositories, organization, or account-wide permissions.
- You are responsible for reviewing every pull request the agent opens before you merge it. Nothing ships to your default branch without your action.

## Acceptable use

You agree not to use the Service to:

- Scan or modify property you do not own or have permission to act on.
- Circumvent access controls, rate limits, or the robots.txt of sites you do not control.
- Reverse-engineer, resell, or overload the Service, or use it to build a competing product.

## Plans and billing

The checkup is free. The AI Search Fix is a one-time upfront payment processed by Dodo Payments after repository confirmation and feasibility review. There is no recurring plan right now.

## Communications

If you join the waitlist, submit the contact form, create an account, or use the Service, we may send you transactional emails related to your request, account, support conversation, or service changes. We use an email provider to deliver those messages. See our [Privacy Policy](${new URL(
  "/privacy",
  SITE.url
).toString()}) for details.

## Intellectual property

You retain all rights to your code and content. The pull requests the agent opens are your work product to accept, modify, or reject. We retain rights to the Service itself, including its software, rubric, and brand.

## Disclaimers and liability

The Service is provided "as is" without warranties of any kind. To the maximum extent permitted by law, GEO Repair is not liable for indirect, incidental, or consequential damages, or for any loss arising from changes you choose to merge.

## Changes to these Terms

We may update these Terms from time to time. Material changes will be reflected by the "last updated" date above. Continued use after a change means you accept the revised Terms.

## Contact

Questions about these Terms? Email hello@geo.repair or see our [Privacy Policy](${new URL(
  "/privacy",
  SITE.url
).toString()}) and [Security](${new URL("/security", SITE.url).toString()}) pages.`

// --- Public API ------------------------------------------------------------

function normalizePath(input: string): string {
  let p = input || "/"
  if (!p.startsWith("/")) p = `/${p}`
  if (p !== "/" && p.endsWith("/")) p = p.slice(0, -1)
  if (p === "/index") p = "/"
  return p
}

// Resolve a page path to its Markdown twin, or null if the page has no twin.
export async function getTwin(rawPath: string): Promise<string | null> {
  const p = normalizePath(rawPath)

  switch (p) {
    case "/":
      return landingTwin(HOME_CONTENT)
    case "/geo-aeo-checker":
      return landingTwin(CHECKER_CONTENT)
    case "/pricing":
      return pricingTwin()
    case "/security":
      return securityTwin()
    case "/contact":
      return contactTwin()
    case "/blog":
      return blogIndexTwin()
    case "/privacy":
      return doc({
        title: "Privacy Policy · GEO Repair",
        description:
          "How GEO Repair handles your data: your code lives only in an ephemeral sandbox, is never retained after a run, and is never used to train models.",
        canonicalPath: "/privacy",
        body: PRIVACY_BODY,
      })
    case "/terms":
      return doc({
        title: "Terms of Service · GEO Repair",
        description:
          "The terms that govern your use of GEO Repair: the free readiness checkup, the AI fix agent, repository access, and your responsibilities as a user.",
        canonicalPath: "/terms",
        body: TERMS_BODY,
      })
  }

  const blog = p.match(/^\/blog\/([^/]+)$/)
  if (blog) return blogPostTwin(blog[1])

  return null
}
