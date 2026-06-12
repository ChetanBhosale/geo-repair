export type FaqItem = { question: string; answer: string }

export type LandingContent = {
  path: string
  metaTitle: string
  metaDescription: string
  eyebrow: string
  headline: string
  headlineAccent: string
  /** Optional text rendered after the highlighted accent, so the accent can
   * sit mid-sentence rather than only at the end of the headline. */
  headlineTail?: string
  subhead: string
  ctaLabel: string
  inputId: string
  trustChips: string[]
  faq: FaqItem[]
}

// Shared answer-first FAQ used as a base; variants extend or override.
const SHARED_TRUST: FaqItem = {
  question: "Do you store or train on my code?",
  answer:
    "No. We clone the one repository you pick into an ephemeral sandbox, make the fixes, open a pull request, and destroy the sandbox. Your code is never retained and is never used to train models. Zero data retention, no model training.",
}

export const HOME_CONTENT: LandingContent = {
  path: "/",
  metaTitle: "GEO Repair · AI Search Optimization for ChatGPT & Perplexity",
  metaDescription:
    "Run a free AI search audit that scores how ready your site is for ChatGPT, Perplexity, and Google AI Overviews, then ships a pull request that fixes it.",
  eyebrow: "AI Search Optimization",
  headline: "Find your AI search issues, then",
  headlineAccent: "raise a PR that fixes them",
  headlineTail: ", in minutes.",
  subhead:
    "Run a free AEO and GEO scan for ChatGPT, Perplexity, and Google AI Overviews. You get an audit report with the evidence behind each issue.",
  ctaLabel: "Run free checkup",
  inputId: "checkup-url",
  trustChips: [
    "26 checks · 7 categories",
    "Fixes in a reviewable PR",
    "Zero data retention",
  ],
  faq: [
    {
      question: "What is AI Search Optimization?",
      answer:
        "AI Search Optimization is the practice of making a website easy for AI answer engines like ChatGPT, Perplexity, Claude, and Google AI Overviews to read, understand, and cite. It extends traditional SEO with server-rendered content, structured data, an llms.txt index, and answer-first writing so engines can quote you accurately.",
    },
    {
      question: "How is this different from traditional SEO?",
      answer:
        "Traditional SEO optimizes for ranking blue links; AI Search Optimization optimizes for being read and cited inside an AI answer. The two overlap on fundamentals like clean HTML and metadata, but AI engines also reward structure they can parse, explicit definitions, and content they can lift directly into a response.",
    },
    {
      question: "Is the checkup really free?",
      answer:
        "Yes. The free AEO and GEO scan needs no signup. It returns an AI search checkup report across all 26 checks and shows what an AI engine sees. You only pay if you want the agent to open fix pull requests for you.",
    },
    SHARED_TRUST,
    {
      question: "Which AI engines does this help with?",
      answer:
        "The same fundamentals improve readiness across ChatGPT, Perplexity, Claude, Microsoft Copilot, and Google AI Overviews, because they all crawl the raw HTML, parse structured data, and prefer answer-first content. We optimize the signals every major engine shares rather than gaming any single one.",
    },
    {
      question: "Can you guarantee my site will get cited by AI?",
      answer:
        "No, and anyone who promises that is misleading you. We measure and improve technical readiness, the on-site signals that make citation possible. Whether an engine cites you also depends on your content's topic and authority, which is why we're honest that educational pages get quoted far more often than transactional ones.",
    },
  ],
}

// --- Shared marketing sections rendered on every landing page ---------------
// Hoisted here (out of the section components) so the page and its Markdown
// "twin" render from one source and never drift. The components map over these;
// the twin in lib/markdown-twin.ts reads the same constants.

export type SectionIntro = {
  eyebrow: string
  title: string
  description?: string
}

export type HowItWorksStep = { n: string; title: string; body: string }

export const HOW_IT_WORKS_INTRO: SectionIntro = {
  eyebrow: "How it works",
  title: "From invisible to cited in three steps",
  description:
    "Start with a checkup, read the diagnosis, and review the pull request when the fix is ready.",
}

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    n: "01",
    title: "Run the free checkup",
    body: "Paste your URL. We fetch your site the way an AI crawler does and score it across 26 checks in 7 categories: rendering, structured data, metadata, crawl surface, semantics, content, and answerability.",
  },
  {
    n: "02",
    title: "See exactly what's broken",
    body: "Get a 0 to 100 readiness score with per-category subscores and the precise evidence behind every check (the offending route, tag, or missing markup), plus what the agent can fix automatically.",
  },
  {
    n: "03",
    title: "Merge the fix PR",
    body: "The agent clones the one repo you pick into an ephemeral sandbox, applies the structural and content fixes, verifies the build and types, and opens a pull request. You review and merge, and nothing ships without you.",
  },
]

export type LandingFeature = {
  eyebrow: string
  title: string
  description: string
  points: string[]
}

// Order matches the two <FeatureSection> blocks in components/sections/landing.tsx.
export const LANDING_FEATURES: LandingFeature[] = [
  {
    eyebrow: "The report",
    title: "A score, then the receipts",
    description:
      "Every check returns a status, the evidence behind it (the offending route, tag, or missing markup), and whether the agent can fix it. No black box.",
    points: [
      "0 to 100 overall score with per-category subscores",
      "Pass, partial, or fail on all 26 checks",
      "Reproducible: the same input always scores the same",
    ],
  },
  {
    eyebrow: "The fix",
    title: "Fixes arrive as a pull request",
    description:
      "The agent only touches the checks it flagged, verifies the build and types in a sandbox, and opens a PR you review. Structural and faithful-reformat fixes ship automatically; net-new content stays gated behind your approval.",
    points: [
      "Bounded to flagged checks, never free-roams your repo",
      "Build and type-checked before the PR opens",
      "You review and merge, nothing ships without you",
    ],
  },
]

export const CHECKER_CONTENT: LandingContent = {
  path: "/geo-aeo-checker",
  metaTitle: "Free GEO and AEO audit with scan report",
  metaDescription:
    "Run a free GEO and AEO audit for answer engine optimization and generative engine optimization. Get a scan report, checkup score, and fix plan.",
  eyebrow: "Free GEO and AEO audit",
  headline: "Free GEO and AEO audit for",
  headlineAccent: "AI citation and visibility.",
  subhead:
    "Paste a URL to run a free AEO scan and GEO scan. We score answer engine optimization and generative engine optimization across 26 checks for ChatGPT, Perplexity, and Google AI Overviews. You see what's blocking the site, then ship the fix in a pull request.",
  ctaLabel: "Check my site",
  inputId: "checker-url",
  trustChips: [
    "Free scan report",
    "AI citation readiness score",
    "Free, no signup",
  ],
  faq: [
    {
      question: "What is a GEO and AEO checker?",
      answer:
        "A GEO and AEO checker audits how ready a website is for generative engine optimization (GEO) and answer engine optimization (AEO). It checks how easily AI engines like ChatGPT and Perplexity can read, understand, and cite the site. GEO Repair runs 26 checks and returns a 0 to 100 report with the exact issues to fix.",
    },
    {
      question: "How does the AI citation checker work?",
      answer:
        "The AI citation checker fetches your page the way an AI crawler would, then grades the on-site signals that correlate with being quoted: server-rendered content, structured data, answer-first definitions, citations to trusted sources, and a clean crawl surface. It reports which signals pass, which are partial, and which fail.",
    },
    {
      question: "What's the difference between GEO and AEO?",
      answer:
        "GEO (generative engine optimization) is the broad practice of optimizing a site to be used by generative AI engines. AEO (answer engine optimization) is the subset focused on answerability: question-shaped headings, FAQ markup, and answer-first writing so an engine can lift a direct answer. Our checker scores both.",
    },
    {
      question: "Is this a free AEO audit and GEO scan?",
      answer:
        "Yes. The AEO audit, AEO scan, GEO scan, and checkup report are free. No signup is needed. You get the full 26-check breakdown with an overall AI search readiness score. Paid plans add the agent that opens fix pull requests for you.",
    },
    SHARED_TRUST,
    {
      question: "Will a high score guarantee AI citations?",
      answer:
        "No. The checker measures technical readiness, not outcomes. A high score removes the on-site blockers to citation, but whether an engine actually cites you also depends on your topic, authority, and content type. We never promise rankings or citations, only that your readiness improved.",
    },
  ],
}
