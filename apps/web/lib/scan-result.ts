// Shared shape + helpers for the public /scan-website result. The free homepage
// scan returns the full ScrapeResult inline (all 26 scored checks plus the
// out-of-scope SSR flag); the hero form renders a summary, and the branded
// /report page renders the whole thing. Both import from here so the type and
// the display helpers never drift.

export type CheckStatus =
  | "SUCCESS"
  | "MID"
  | "FAILED"
  | "NOT_APPLICABLE"
  | "INCONCLUSIVE"

export type CategoryScore = {
  score: number
  status: CheckStatus
}

export type AffectedPage = {
  page: string
  status?: CheckStatus
  issue?: string
  recommendation?: string | null
}

export type SiteCheck = {
  name: string
  category: string
  status: CheckStatus
  weight: number
  tier?: "A" | "B" | "C" | "out-of-scope"
  fixableByAgent?: boolean | "partial"
  summary: string
  recommendation: string | null
  affectedPages: AffectedPage[]
}

export type ScanResult = {
  url: string
  finalUrl: string
  status: "completed" | "failed"
  error: string | null
  rubricVersion?: string
  score: {
    overall: number
    status: CheckStatus
    byCategory: Record<string, CategoryScore>
  }
  crawl: {
    pagesChecked: number
    pagesDiscovered: number
  }
  checks: SiteCheck[]
}

// Canonical category order for grouping in the report.
export const RUBRIC_CATEGORY_ORDER = [
  "Rendering",
  "Structured data",
  "Metadata",
  "Crawl surface",
  "Semantics",
  "Content",
  "Answerability",
] as const

// Friendly labels for the raw check ids the scanner returns. Anything not listed
// falls back to a title-cased slug, so the report never shows a raw kebab id.
const CHECK_LABELS: Record<string, string> = {
  "ssr-visibility": "Server-side rendering",
  "structured-data": "Structured data (JSON-LD)",
  "meta-tags": "Title & meta description",
  "open-graph": "Open Graph & Twitter cards",
  "canonical-urls": "Canonical URLs",
  "robots-ai-crawlers": "AI crawler access",
  sitemap: "XML sitemap",
  "llms-txt": "/llms.txt index",
  "semantic-html": "Semantic HTML & landmarks",
  "image-alt-text": "Image alt text",
  "internal-linking": "Internal linking",
  answerability: "Answerability (AEO)",
  "freshness-eeat": "Freshness & E-E-A-T",
  "interactive-labels": "Accessible control names",
  indexability: "Index eligibility",
  "citation-quality": "Citation quality",
  definitions: "Answer-first definitions",
  charset: "Charset declaration",
  doctype: "HTML5 doctype",
  favicon: "Favicon & touch icon",
  hreflang: "hreflang annotations",
  "social-image-size": "Social image size",
  "markdown-twin": "Markdown twin",
  "markdown-twins": "Markdown twin",
  "mobile-viewport": "Mobile viewport",
  "content-negotiation": "Content negotiation",
  "ai-delivery-headers": "AI delivery headers",
  "aeo-conformance": "AEO conformance",
}

export function checkLabel(name: string): string {
  if (CHECK_LABELS[name]) return CHECK_LABELS[name]
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function statusLabel(status: CheckStatus): string {
  switch (status) {
    case "SUCCESS":
      return "Pass"
    case "MID":
      return "Partial"
    case "FAILED":
      return "Fail"
    case "NOT_APPLICABLE":
      return "N/A"
    case "INCONCLUSIVE":
      return "Unclear"
  }
}

export type StatusTone = "success" | "warning" | "destructive" | "muted"

export function statusTone(status: CheckStatus): StatusTone {
  switch (status) {
    case "SUCCESS":
      return "success"
    case "MID":
      return "warning"
    case "FAILED":
      return "destructive"
    default:
      return "muted"
  }
}

// Tailwind background class for a 0–100 score bar.
export function categoryColor(score: number): string {
  if (score >= 80) return "bg-success"
  if (score >= 50) return "bg-warning"
  return "bg-destructive"
}

export function hostnameOf(value: string): string {
  try {
    return new URL(value).hostname
  } catch {
    return value
  }
}

// The agent can auto-apply a fix when the scanner marks the check fixable. A
// "partial" value means structural fixes ship but net-new content stays gated.
export function isAutoFixable(check: SiteCheck): boolean {
  return check.fixableByAgent === true || check.fixableByAgent === "partial"
}

// --- ephemeral hand-off ----------------------------------------------------
// The free scan persists nothing server-side, so we stash the last result in
// localStorage to hand it to the /report tab. localStorage (not sessionStorage)
// because the report opens in a new tab on the same origin.
export const STORED_SCAN_KEY = "geo-repair:last-scan"

export function storeScan(result: ScanResult): void {
  try {
    localStorage.setItem(STORED_SCAN_KEY, JSON.stringify(result))
  } catch {
    // Private mode / quota — the report tab will show its empty state.
  }
}

export function loadStoredScan(): ScanResult | null {
  try {
    const raw = localStorage.getItem(STORED_SCAN_KEY)
    return raw ? (JSON.parse(raw) as ScanResult) : null
  } catch {
    return null
  }
}
