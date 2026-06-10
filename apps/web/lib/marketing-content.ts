import {
  CHAT_MESSAGE_LIMIT,
  FIX_ATTEMPT_LIMIT,
} from "@repo/types/entitlements"
import type { FaqItem, SectionIntro } from "./landing-content"

// Structured copy for the pricing, security, and contact pages. Hoisted out of
// the page components so each page and its Markdown "twin" (lib/markdown-twin.ts)
// render from one source and never drift.

// --- Pricing ---------------------------------------------------------------

// A vertical plan card for the free checkup. The one-time fix uses its own
// page-count tier shape below (FixTier).
export type PricingTier = {
  name: string
  price: string
  cadence?: string
  blurb: string
  features: string[]
  cta: string
  href: string
  note?: string
  featured?: boolean
}

export const PRICING_HEADER: SectionIntro = {
  eyebrow: "Pricing",
  title: "Free to check. Pay once to fix.",
  description:
    "Run the checkup for nothing. Pay a single one-time fee, sized to your site, only when you want the agent to ship the fixes.",
}

// Step 1 — the free entry point.
export const PRICING_FREE: PricingTier = {
  name: "Free checkup",
  price: "$0",
  blurb:
    "Check any public site and get the full readiness picture, the same scoring our fix agent works from.",
  features: [
    "Check any public website",
    "0–100 readiness score with per-category subscores",
    "All 23 checks across 7 categories",
    "Evidence and a fix hint for every issue",
    "Respects your robots.txt, never touches your repo",
  ],
  cta: "Run free checkup",
  href: "/#checkup",
  note: "No signup or card required",
}

// Step 2 — the one-time fix, priced by sitemap page count (computed during the
// free checkup; see plan.md → Pricing). Tiers mirror the canonical table.
export type FixTier = {
  name: string
  pages: string
  price: string
  href: string
  cta: string
  featured?: boolean
}

export const FIX_TIERS_INTRO: SectionIntro = {
  eyebrow: "Pay once to fix",
  title: "A one-time fix, sized to your site",
  description:
    "When you connect a repository, the agent opens the pull requests that close the gaps the checkup found. You pay once. The tier is set automatically by how many pages are in your sitemap, measured during the free checkup, and shown before you pay anything.",
}

export const FIX_TIERS: FixTier[] = [
  {
    name: "Starter",
    pages: "Up to 25 pages",
    price: "$49",
    href: "/#checkup",
    cta: "Run free checkup",
  },
  {
    name: "Growth",
    pages: "Up to 100 pages",
    price: "$149",
    href: "/#checkup",
    cta: "Run free checkup",
    featured: true,
  },
  {
    name: "Scale",
    pages: "Up to 250 pages",
    price: "$399",
    href: "/#checkup",
    cta: "Run free checkup",
  },
  {
    name: "Enterprise",
    pages: "250+ pages",
    price: "Custom",
    href: "/contact",
    cta: "Talk to us",
  },
]

export const FIX_INCLUDES = [
  "The agent fixes every flagged check and opens one pull request",
  "Build- and type-checked in an ephemeral sandbox before the PR opens",
  "You review and merge. Nothing ships without you",
  "Net-new content stays gated behind your approval",
  `Up to ${FIX_ATTEMPT_LIMIT} fix attempts if a run needs a retry`,
  `${CHAT_MESSAGE_LIMIT} follow-up chat messages to refine the pull request with the agent`,
  "Charged once, upfront, only after we confirm your stack is buildable",
]

export const PRICING_FOOTNOTE =
  "The fix is a single upfront charge sized to your sitemap. We never promise rankings or AI citations, only that your site is measurably more ready."

export const PRICING_FAQ_INTRO = {
  title: "Pricing questions",
  description: "What people ask before they pay.",
}

export const PRICING_FAQ: FaqItem[] = [
  {
    question: "Is the checkup really free?",
    answer:
      "Yes. The checkup reads your public pages and returns the full 0–100 score with every check, with no signup and no card. You only pay when you connect a repository and want the agent to open the fixing pull requests.",
  },
  {
    question: "How much does the fix cost?",
    answer:
      "The fix is a one-time fee based on how many pages are in your sitemap: $49 up to 25 pages, $149 up to 100, $399 up to 250, and custom pricing beyond that. We measure your page count automatically during the free checkup and show your exact price before you pay anything.",
  },
  {
    question: "When do I pay?",
    answer:
      "You pay only after the free checkup, repository confirmation, and feasibility gate. The checkout amount is computed server-side from the sitemap page count, so the browser never decides the price.",
  },
  {
    question: "What if the fix can't be applied?",
    answer:
      "Before charging, we confirm your stack is supported and buildable. If we can't produce a build-passing pull request, we open a direct support thread to make it right. We don't leave you with a charge and nothing to show.",
  },
  {
    question: "Do you guarantee more traffic or AI citations?",
    answer:
      "No, and you should be wary of anyone who does. We measure and improve how ready your site is for AI search engines to read and cite it. Whether a model cites you is outside anyone's control. We fix the technical readiness, not the ranking.",
  },
  {
    question: "Is this recurring?",
    answer:
      "No. The AI Search Fix is a single upfront charge, so there is no recurring plan to cancel.",
  },
]

// --- Security --------------------------------------------------------------

export type AccessItem = { label: string; allowed: boolean }
export type LifecycleStage = { title: string; body: string }

export const SECURITY_HEADER: SectionIntro = {
  eyebrow: "Security & trust",
  title: "One repo, in a sandbox, then gone",
  description:
    "GEO Repair is built to need as little of your trust as possible. Here's exactly what we touch, what we never touch, and what happens to your code.",
}

export const SECURITY_COMMITMENTS_INTRO: SectionIntro = {
  eyebrow: "Our commitments",
  title: "Four promises we design around",
}

export const SECURITY_ACCESS_INTRO: SectionIntro = {
  eyebrow: "Least privilege",
  title: "What we access, and what we don't",
  description:
    "We ask for the narrowest access that lets us open a useful pull request, and nothing more.",
}

export const SECURITY_LIFECYCLE_INTRO: SectionIntro = {
  eyebrow: "Sandbox lifecycle",
  title: "What happens during a fix run",
  description:
    "Every run is isolated and short-lived. Here's the full lifecycle, start to finish.",
}

export const SECURITY_ACCESS: AccessItem[] = [
  { label: "The one public site you check (free checkup)", allowed: true },
  { label: "The single repository you explicitly select", allowed: true },
  { label: "An ephemeral sandbox that's destroyed after the run", allowed: true },
  { label: "Your other repositories or your whole account", allowed: false },
  { label: "Your code, retained after the pull request opens", allowed: false },
  { label: "Your code, used to train models", allowed: false },
]

export const SECURITY_LIFECYCLE: LifecycleStage[] = [
  {
    title: "Provision",
    body: "When you approve a fix, we spin up a fresh, isolated sandbox scoped to the single repository you picked.",
  },
  {
    title: "Clone & fix",
    body: "The repo is cloned into the sandbox. The agent edits only the checks it flagged, then runs the build and type-check to verify nothing broke.",
  },
  {
    title: "Open the PR",
    body: "The agent pushes a branch and opens a pull request for your review. You decide what merges.",
  },
  {
    title: "Destroy",
    body: "The sandbox and its clone are torn down. Nothing about your code persists on our side.",
  },
]

export const SECURITY_FAQ_INTRO = {
  title: "Security questions",
  description: "The things people ask before they connect a repo.",
}

export const SECURITY_FAQ: FaqItem[] = [
  {
    question: "Do you store my source code?",
    answer:
      "No. Your code lives only inside an ephemeral sandbox for the duration of a single run. Once the pull request is opened, the sandbox and the clone are destroyed and nothing is retained.",
  },
  {
    question: "Do you train AI models on my code?",
    answer:
      "No. Your code is never used to train models. It is read to make the specific fixes you approved and for nothing else.",
  },
  {
    question: "What access do you request on my repository?",
    answer:
      "Least-privilege, single-repository access. We request access to the one repository you select, never your other repositories, organization, or account-wide permissions.",
  },
  {
    question: "Does the free checkup touch my code at all?",
    answer:
      "No. The free checkup only fetches your public pages, the same way an AI crawler would, and respects your robots.txt. It never touches your repository; that only happens if you approve a fix run.",
  },
]

// --- Contact ---------------------------------------------------------------

export const SUPPORT_EMAIL = "hello@geo.repair"
export const SECURITY_EMAIL = "security@geo.repair"

export type ContactChannel = {
  label: string
  value: string
  href: string
  body: string
}

export const CONTACT_HEADER: SectionIntro = {
  eyebrow: "Contact",
  title: "Talk to the team",
  description:
    "Whether you're sizing up the checkup, weighing a plan, or vetting our security, the fastest way to reach us is email.",
}

export const CONTACT_CHANNELS: ContactChannel[] = [
  {
    label: "General & sales",
    value: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
    body: "Questions about the checkup, the fix agent, or a plan. We read every message.",
  },
  {
    label: "Security",
    value: SECURITY_EMAIL,
    href: `mailto:${SECURITY_EMAIL}`,
    body: "Report a vulnerability or ask about our sandbox, access scope, and data handling.",
  },
]

// --- About -----------------------------------------------------------------

// The founder email is intentionally a person, not a shared inbox: it backs the
// 24-hour response promise below and is the page's most-citable, most-human fact.
export const FOUNDER_EMAIL = "ajay@geo.repair"

export const ABOUT_HEADER: SectionIntro = {
  eyebrow: "About",
  title: "Built by two founders who lived this problem first",
  description:
    "GEO Repair is made by Ajay Pawriya and Chetan Bhosale. We built it after spending three months teaching our own product to rank in search and get cited by AI, then turned what we learned into a tool so you don't have to.",
}

export const ABOUT_STORY_INTRO: SectionIntro = {
  eyebrow: "Why we built it",
  title: "We wasted three months in the dark, so you don't have to",
}

// Plain, factual paragraphs — written to be extracted and cited as the canonical
// answer to "who makes GEO Repair and why". No new product claims beyond the
// rest of the site.
export const ABOUT_STORY: string[] = [
  "GEO Repair started with our own problem. When we built our previous product, linkrunner.io, getting it to rank in search engines — and getting answer engines like ChatGPT, Perplexity, and Google AI Overviews to cite it — took us more than three months of trial and error. Most of the advice online was vague, conflicting, or already out of date.",
  "By the end we understood how AI search actually decides what to surface and cite: the structure it reads, the signals it trusts, and the specific fixes that move the needle. The hard part was never knowing a fix existed — it was finding the root cause without flying blind for weeks.",
  "So we built GEO Repair to hand that work to everyone else. It audits your site against the same understanding we paid for in time, then ships the fixes as a pull request. What took us months now takes minutes.",
]

export type Founder = {
  name: string
  role: string
  bio: string
  handle: string
  x: string
}

export const FOUNDERS: Founder[] = [
  {
    name: "Ajay Pawriya",
    role: "Co-founder",
    bio: "Builds the product and handles support directly. Email him and you're talking to the person who can fix it.",
    handle: "@ajay__pawriya",
    x: "https://x.com/ajay__pawriya",
  },
  {
    name: "Chetan Bhosale",
    role: "Co-founder",
    bio: "Works on the fix agent and the scoring behind every checkup, the same engine GEO Repair runs your site through.",
    handle: "@cbtweets810",
    x: "https://x.com/cbtweets810",
  },
]

export const ABOUT_PROMISE = {
  eyebrow: "The promise",
  title: "You're talking to the people who build it",
  body: `We're a two-person team, so there's no support queue between you and the people writing the code. Have a question, hit a bug, or want a feature? Email Ajay at ${FOUNDER_EMAIL} and we aim to fix it or ship it within 24 hours.`,
  email: FOUNDER_EMAIL,
}
