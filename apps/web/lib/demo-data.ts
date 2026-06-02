import type { CheckStatus, CheckTier, RubricCategory } from "./rubric-meta"
import { RUBRIC_CATEGORIES } from "./rubric-meta"

export type DemoCheck = {
  id: string
  label: string
  category: RubricCategory
  weight: number
  tier: CheckTier
  status: CheckStatus
  evidence: string
  fixableByAgent: boolean
  fixHint: string
}

// Canned sample report typed to the @repo/checker schema. Statuses are chosen to
// land an overall score of 61 (43.5 / 71 weighted), a believable "decent site,
// invisible to AI search" result. Same output regardless of the URL entered.
export const DEMO_CHECKS: DemoCheck[] = [
  {
    id: "ssr-visibility",
    label: "Server-side rendering",
    category: "Rendering",
    weight: 10,
    tier: "out-of-scope",
    status: "pass",
    evidence: "Primary content present in the raw HTML response (no hydration gap).",
    fixableByAgent: false,
    fixHint:
      "Already server-rendered. If this fails, CSR→SSR is flagged only, never auto-edited.",
  },
  {
    id: "structured-data",
    label: "Structured data (JSON-LD)",
    category: "Structured data",
    weight: 6,
    tier: "A",
    status: "partial",
    evidence: "Organization present; Article and BreadcrumbList missing on content routes.",
    fixableByAgent: true,
    fixHint: "Emit Article + BreadcrumbList JSON-LD from existing page data.",
  },
  {
    id: "meta-tags",
    label: "Title & meta description",
    category: "Metadata",
    weight: 6,
    tier: "A",
    status: "partial",
    evidence: "3 routes share one description; 2 titles exceed ~60 chars.",
    fixableByAgent: true,
    fixHint: "Derive unique, in-range titles/descriptions from each page's H1.",
  },
  {
    id: "open-graph",
    label: "Open Graph & Twitter cards",
    category: "Metadata",
    weight: 3,
    tier: "A",
    status: "fail",
    evidence: "No og: or twitter: tags found in <head>.",
    fixableByAgent: true,
    fixHint: "Add core OG + Twitter tags with a correct og:type per route.",
  },
  {
    id: "canonical-urls",
    label: "Canonical URLs",
    category: "Metadata",
    weight: 3,
    tier: "A",
    status: "pass",
    evidence: "Self-referential absolute canonical on every route.",
    fixableByAgent: true,
    fixHint: "No action needed.",
  },
  {
    id: "robots-ai-crawlers",
    label: "AI crawler access",
    category: "Crawl surface",
    weight: 6,
    tier: "A",
    status: "partial",
    evidence: "robots.txt allows Googlebot but omits GPTBot, ClaudeBot, PerplexityBot.",
    fixableByAgent: true,
    fixHint: "Add allow rules for the major AI crawlers without touching existing disallows.",
  },
  {
    id: "sitemap",
    label: "XML sitemap",
    category: "Crawl surface",
    weight: 3,
    tier: "A",
    status: "pass",
    evidence: "Valid sitemap.xml referenced from robots.txt.",
    fixableByAgent: true,
    fixHint: "No action needed.",
  },
  {
    id: "llms-txt",
    label: "/llms.txt index",
    category: "Crawl surface",
    weight: 3,
    tier: "A",
    status: "fail",
    evidence: "No /llms.txt served.",
    fixableByAgent: true,
    fixHint: "Generate /llms.txt with site name, description, and curated page links.",
  },
  {
    id: "semantic-html",
    label: "Semantic HTML & landmarks",
    category: "Semantics",
    weight: 3,
    tier: "A",
    status: "partial",
    evidence: "Two <h1> elements on the homepage; <main> landmark missing.",
    fixableByAgent: true,
    fixHint: "Demote the duplicate H1 and wrap primary content in <main>.",
  },
  {
    id: "image-alt-text",
    label: "Image alt text",
    category: "Semantics",
    weight: 1,
    tier: "A",
    status: "partial",
    evidence: "6 of 14 content images have empty or missing alt attributes.",
    fixableByAgent: true,
    fixHint: "Add descriptive alt to meaningful images; alt=\"\" for decorative ones.",
  },
  {
    id: "internal-linking",
    label: "Internal linking",
    category: "Content",
    weight: 1,
    tier: "A",
    status: "pass",
    evidence: "Descriptive anchor text; no orphan pages detected.",
    fixableByAgent: true,
    fixHint: "No action needed.",
  },
  {
    id: "answerability",
    label: "Answerability (AEO)",
    category: "Answerability",
    weight: 6,
    tier: "A",
    status: "partial",
    evidence: "Some question-shaped headings; no FAQPage schema where Q&A already renders.",
    fixableByAgent: true,
    fixHint: "Mark up existing Q&A as FAQPage. Net-new FAQ authoring is gated (Tier C).",
  },
  {
    id: "freshness-eeat",
    label: "Freshness & E-E-A-T",
    category: "Content",
    weight: 1,
    tier: "A",
    status: "partial",
    evidence: "Author present on posts; published/updated dates not surfaced.",
    fixableByAgent: true,
    fixHint: "Surface visible dates where derivable from frontmatter.",
  },
  {
    id: "interactive-labels",
    label: "Accessible control names",
    category: "Semantics",
    weight: 1,
    tier: "A",
    status: "partial",
    evidence: "3 icon-only buttons lack an accessible name.",
    fixableByAgent: true,
    fixHint: "Add aria-label to icon-only controls.",
  },
  {
    id: "indexability",
    label: "Index eligibility",
    category: "Crawl surface",
    weight: 6,
    tier: "A",
    status: "pass",
    evidence: "No noindex on primary routes; Googlebot allowed; 200 status.",
    fixableByAgent: true,
    fixHint: "No action needed.",
  },
  {
    id: "citation-quality",
    label: "Citation quality",
    category: "Content",
    weight: 3,
    tier: "A",
    status: "fail",
    evidence: "Claims reference studies in prose but link no external sources.",
    fixableByAgent: true,
    fixHint: "Wire real outbound links where the prose already names a source.",
  },
  {
    id: "definitions",
    label: "Answer-first definitions",
    category: "Answerability",
    weight: 3,
    tier: "A",
    status: "partial",
    evidence: "Key terms defined mid-section rather than answer-first.",
    fixableByAgent: true,
    fixHint: "Reorder existing definitions to the top of their section and mark up.",
  },
  {
    id: "charset",
    label: "Charset declaration",
    category: "Rendering",
    weight: 1,
    tier: "A",
    status: "pass",
    evidence: "<meta charset=\"utf-8\"> declared early in <head>.",
    fixableByAgent: true,
    fixHint: "No action needed.",
  },
  {
    id: "doctype",
    label: "HTML5 doctype",
    category: "Rendering",
    weight: 1,
    tier: "A",
    status: "pass",
    evidence: "<!DOCTYPE html> present.",
    fixableByAgent: true,
    fixHint: "No action needed.",
  },
  {
    id: "favicon",
    label: "Favicon & touch icon",
    category: "Metadata",
    weight: 1,
    tier: "A",
    status: "pass",
    evidence: "icon and apple-touch-icon links wired.",
    fixableByAgent: true,
    fixHint: "No action needed.",
  },
  {
    id: "hreflang",
    label: "hreflang annotations",
    category: "Metadata",
    weight: 1,
    tier: "A",
    status: "pass",
    evidence: "Single-locale site; hreflang not applicable.",
    fixableByAgent: true,
    fixHint: "No action needed unless translated routes are added.",
  },
  {
    id: "social-image-size",
    label: "Social image size",
    category: "Metadata",
    weight: 1,
    tier: "A",
    status: "fail",
    evidence: "No OG image, so nothing unfurls in chats or social.",
    fixableByAgent: true,
    fixHint: "Add a templated 1200×630 OG image with declared width/height.",
  },
  {
    id: "markdown-twins",
    label: "Markdown twins",
    category: "Content",
    weight: 1,
    tier: "B",
    status: "fail",
    evidence: "No Markdown twin (e.g. /page.md) served for any primary page.",
    fixableByAgent: true,
    fixHint:
      "Emit a faithful .md twin per primary page from its own content, link it via rel=alternate, and index it in /llms.txt.",
  },
]

const STATUS_FACTOR: Record<CheckStatus, number> = {
  pass: 1,
  partial: 0.5,
  fail: 0,
}

export function overallScore(checks: DemoCheck[] = DEMO_CHECKS): number {
  const max = checks.reduce((sum, c) => sum + c.weight, 0)
  const earned = checks.reduce(
    (sum, c) => sum + c.weight * STATUS_FACTOR[c.status],
    0
  )
  return Math.round((earned / max) * 100)
}

export type CategorySubscore = {
  category: RubricCategory
  score: number
  checks: DemoCheck[]
  passCount: number
  total: number
}

export function categorySubscores(
  checks: DemoCheck[] = DEMO_CHECKS
): CategorySubscore[] {
  return RUBRIC_CATEGORIES.map((category) => {
    const group = checks.filter((c) => c.category === category)
    const max = group.reduce((sum, c) => sum + c.weight, 0)
    const earned = group.reduce(
      (sum, c) => sum + c.weight * STATUS_FACTOR[c.status],
      0
    )
    return {
      category,
      score: max === 0 ? 0 : Math.round((earned / max) * 100),
      checks: group,
      passCount: group.filter((c) => c.status === "pass").length,
      total: group.length,
    }
  })
}

export const DEMO_SCORE = overallScore()
export const DEMO_CATEGORY_SUBSCORES = categorySubscores()
