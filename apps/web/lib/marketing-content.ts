import type { FaqItem, SectionIntro } from "./landing-content"

// Structured copy for the pricing, security, and contact pages. Hoisted out of
// the page components so each page and its Markdown "twin" (lib/markdown-twin.ts)
// render from one source and never drift.

// --- Pricing ---------------------------------------------------------------

// A free/subscription plan card (free checkup, Autopilot). The one-time fix
// uses its own page-count tier shape below (FixTier).
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
    "Run the checkup for nothing. Pay a single one-time fee, sized to your site, only when you want the agent to ship the fixes. Keep your readiness from sliding back with optional Autopilot.",
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
    "When you connect a repository, the agent opens the pull requests that close the gaps the checkup found. You pay once — the tier is set automatically by how many pages are in your sitemap, measured during the free checkup, and shown before you pay anything.",
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
  "You review and merge — nothing ships without you",
  "Net-new content stays gated behind your approval",
  "Charged once, upfront, only after we confirm your stack is buildable",
]

// Step 3 — optional subscription, after the fix is merged. This is the
// loop-closer, not the thing that produces the first fix PR.
export const AUTOPILOT: PricingTier = {
  name: "AI Search Autopilot",
  price: "$19",
  cadence: "/mo",
  blurb:
    "After you've merged the fix, keep your readiness from sliding back. Autopilot re-checks on a schedule and opens improvement PRs when something regresses.",
  features: [
    "Continuous re-checks on a schedule",
    "A readiness change-log over time",
    "Regression-catching improvement PRs",
    "Cancel anytime, month to month",
  ],
  cta: "Start with a free checkup",
  href: "/#checkup",
  note: "Optional — added after your first fix ships",
}

export const PRICING_FOOTNOTE =
  "The fix is a single upfront charge sized to your sitemap; Autopilot is a separate, optional subscription. We never promise rankings or AI citations, only that your site is measurably more ready."

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
    question: "What's the difference between the fix and Autopilot?",
    answer:
      "The one-time fix opens the pull requests that close the gaps the checkup found — you pay once. AI Search Autopilot ($19/mo) is optional and comes afterward: it keeps watching, re-checks on a schedule, and opens improvement PRs if your readiness regresses.",
  },
  {
    question: "What if the fix can't be applied?",
    answer:
      "Before charging, we confirm your stack is supported and buildable. If we can't produce a build-passing pull request, we open a direct support thread to make it right — we don't leave you with a charge and nothing to show.",
  },
  {
    question: "Do you guarantee more traffic or AI citations?",
    answer:
      "No, and you should be wary of anyone who does. We measure and improve how ready your site is for AI search engines to read and cite it. Whether a model cites you is outside anyone's control. We fix the technical readiness, not the ranking.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "The one-time fix is a single upfront charge — there's nothing to cancel. Autopilot is month-to-month with no contract, so you can cancel it anytime, and the free checkup stays available either way.",
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
  {
    label: "GitHub",
    value: "github.com/geo-repair",
    href: "https://github.com/geo-repair",
    body: "Issues and discussion for the open parts of the project.",
  },
]
