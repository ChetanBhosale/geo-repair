// Canonical GEO/AEO checks (RUBRIC.md v1). Single source of truth for the
// scraper worker: each entry drives one check evaluator, its weight, and how it
// is fixed. Keep IDs, categories, and tiers identical to RUBRIC.md.

export const RUBRIC_VERSION = "v1";

export type CheckCategory =
  | "Rendering"
  | "Structured data"
  | "Metadata"
  | "Crawl surface"
  | "Semantics"
  | "Content"
  | "Answerability";

export type CheckTier = "A" | "B" | "C" | "out-of-scope";

export type CheckPriority = "critical" | "high" | "medium" | "low";

export type CheckScope = "site-wide" | "per-page";

export type Fixability = true | false | "partial";

export interface CheckIntent {
  name: string;
  category: CheckCategory;
  tier: CheckTier;
  priority: CheckPriority;
  weight: number;
  fixableByAgent: Fixability;
  scope: CheckScope;
  intent: string;
}

export const PRIORITY_WEIGHT: Record<CheckPriority, number> = {
  critical: 30,
  high: 20,
  medium: 12,
  low: 6,
};

export const check_intent: CheckIntent[] = [
  {
    name: "ssr-visibility",
    category: "Rendering",
    tier: "out-of-scope",
    priority: "critical",
    weight: PRIORITY_WEIGHT.critical,
    fixableByAgent: false,
    scope: "per-page",
    intent:
      "Raw no-JS HTML must contain the primary content. If content only appears after hydration, AI crawlers miss it. Measured but flag-only (CSR to SSR is out of scope).",
  },
  {
    name: "structured-data",
    category: "Structured data",
    tier: "A",
    priority: "high",
    weight: PRIORITY_WEIGHT.high,
    fixableByAgent: true,
    scope: "per-page",
    intent:
      "Valid JSON-LD: Organization and WebSite site-wide, Article on article routes, BreadcrumbList on hierarchical pages. Real data only.",
  },
  {
    name: "meta-tags",
    category: "Metadata",
    tier: "A",
    priority: "high",
    weight: PRIORITY_WEIGHT.high,
    fixableByAgent: true,
    scope: "per-page",
    intent:
      "title (50 to 60 chars) and meta description (120 to 160 chars) present, non-empty, unique per route. Add missing or safely derive; never reword human copy to hit a length.",
  },
  {
    name: "open-graph",
    category: "Metadata",
    tier: "A",
    priority: "medium",
    weight: PRIORITY_WEIGHT.medium,
    fixableByAgent: true,
    scope: "per-page",
    intent:
      "Complete Open Graph + Twitter cards with correct og:type (website/article/product) and a resolvable OG image. Wire an existing image or a templated card, never generate imagery.",
  },
  {
    name: "canonical-urls",
    category: "Metadata",
    tier: "A",
    priority: "medium",
    weight: PRIORITY_WEIGHT.medium,
    fixableByAgent: true,
    scope: "per-page",
    intent: "Self-referential, absolute canonical URL per route.",
  },
  {
    name: "robots-ai-crawlers",
    category: "Crawl surface",
    tier: "A",
    priority: "high",
    weight: PRIORITY_WEIGHT.high,
    fixableByAgent: true,
    scope: "site-wide",
    intent:
      "robots.txt allows AI crawlers (GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, CCBot) and never accidentally blocks them. Preserve intentional disallows.",
  },
  {
    name: "sitemap",
    category: "Crawl surface",
    tier: "A",
    priority: "medium",
    weight: PRIORITY_WEIGHT.medium,
    fixableByAgent: true,
    scope: "site-wide",
    intent:
      "Present, valid, referenced from robots.txt. Also drives pricing via page count.",
  },
  {
    name: "llms-txt",
    category: "Crawl surface",
    tier: "A",
    priority: "medium",
    weight: PRIORITY_WEIGHT.medium,
    fixableByAgent: true,
    scope: "site-wide",
    intent:
      "/llms.txt (Markdown) with site name, description, and curated key-page links.",
  },
  {
    name: "semantic-html",
    category: "Semantics",
    tier: "A",
    priority: "medium",
    weight: PRIORITY_WEIGHT.medium,
    fixableByAgent: true,
    scope: "per-page",
    intent:
      "One h1, correct heading hierarchy, landmarks (header/nav/main/footer), and a sound accessibility tree. Text-preserving structural fixes only.",
  },
  {
    name: "image-alt-text",
    category: "Semantics",
    tier: "A",
    priority: "low",
    weight: PRIORITY_WEIGHT.low,
    fixableByAgent: true,
    scope: "per-page",
    intent:
      "Meaningful images have accurate alt text; decorative images use alt=\"\". No keyword stuffing.",
  },
  {
    name: "internal-linking",
    category: "Content",
    tier: "A",
    priority: "low",
    weight: PRIORITY_WEIGHT.low,
    fixableByAgent: true,
    scope: "per-page",
    intent: "Descriptive anchor text (no \"click here\"); no orphan pages.",
  },
  {
    name: "answerability",
    category: "Answerability",
    tier: "A",
    priority: "high",
    weight: PRIORITY_WEIGHT.high,
    fixableByAgent: "partial",
    scope: "per-page",
    intent:
      "Question-shaped headings + FAQ blocks; FAQPage schema when Q&A already renders (Tier A). Net-new FAQ authoring is Tier C (gated).",
  },
  {
    name: "freshness-eeat",
    category: "Content",
    tier: "A",
    priority: "low",
    weight: PRIORITY_WEIGHT.low,
    fixableByAgent: "partial",
    scope: "per-page",
    intent:
      "Visible dates, author, and about/contact signals. Auto where dates/author are derivable, else flag.",
  },
  {
    name: "interactive-labels",
    category: "Semantics",
    tier: "A",
    priority: "low",
    weight: PRIORITY_WEIGHT.low,
    fixableByAgent: true,
    scope: "per-page",
    intent:
      "Every interactive element (button, link, input, select) has a programmatic accessible name; no focusable control hidden from the a11y tree; valid roles.",
  },
  {
    name: "indexability",
    category: "Crawl surface",
    tier: "A",
    priority: "high",
    weight: PRIORITY_WEIGHT.high,
    fixableByAgent: "partial",
    scope: "per-page",
    intent:
      "Page is eligible for search: no noindex (meta or X-Robots-Tag), robots doesn't block Googlebot/Bingbot on real routes, self-referential canonical, 200 status. Preserve intentional noindex.",
  },
  {
    name: "citation-quality",
    category: "Content",
    tier: "A",
    priority: "medium",
    weight: PRIORITY_WEIGHT.medium,
    fixableByAgent: "partial",
    scope: "per-page",
    intent:
      "Does the content cite trusted external sources (.gov/.edu, standards bodies, primary data)? Tier A wires real outbound links where prose names a source; net-new sourcing is Tier C. Never invent a source.",
  },
  {
    name: "definitions",
    category: "Answerability",
    tier: "A",
    priority: "medium",
    weight: PRIORITY_WEIGHT.medium,
    fixableByAgent: "partial",
    scope: "per-page",
    intent:
      "Answer-first content that defines its terms (\"X is Y\" up front). Tier A surfaces and marks up existing definitions (DefinedTerm); writing net-new is Tier C.",
  },
  {
    name: "charset",
    category: "Rendering",
    tier: "A",
    priority: "low",
    weight: PRIORITY_WEIGHT.low,
    fixableByAgent: true,
    scope: "site-wide",
    intent:
      "<meta charset=\"utf-8\"> declared early in head (within ~1024 bytes). Prevents mojibake.",
  },
  {
    name: "doctype",
    category: "Rendering",
    tier: "A",
    priority: "low",
    weight: PRIORITY_WEIGHT.low,
    fixableByAgent: true,
    scope: "site-wide",
    intent:
      "HTML5 <!DOCTYPE html> present so the browser renders in standards mode, not quirks mode.",
  },
  {
    name: "favicon",
    category: "Metadata",
    tier: "A",
    priority: "low",
    weight: PRIORITY_WEIGHT.low,
    fixableByAgent: "partial",
    scope: "site-wide",
    intent:
      "Favicon + Apple touch icon wired. Wire existing icon assets; flag only when no asset exists (never generate imagery).",
  },
  {
    name: "hreflang",
    category: "Metadata",
    tier: "A",
    priority: "low",
    weight: PRIORITY_WEIGHT.low,
    fixableByAgent: "partial",
    scope: "per-page",
    intent:
      "When translated routes already exist, emit hreflang annotations (+ x-default) mapping each page to its variants. Never invent locales.",
  },
  {
    name: "social-image-size",
    category: "Metadata",
    tier: "A",
    priority: "low",
    weight: PRIORITY_WEIGHT.low,
    fixableByAgent: true,
    scope: "per-page",
    intent:
      "The OG/Twitter image is fit for unfurling: >= 1200x630, a web format (not SVG), sane file size, with declared width/height. Validates the wired image; does not select or generate one.",
  },
  {
    name: "markdown-twin",
    category: "Content",
    tier: "B",
    priority: "medium",
    weight: PRIORITY_WEIGHT.medium,
    fixableByAgent: true,
    scope: "per-page",
    intent:
      "Each primary page exposes a faithful Markdown twin at <path>.md that returns 200 with Content-Type text/markdown; charset=utf-8 and a non-empty body. Reformat existing content only, no new claims (the only Tier B check).",
  },
  {
    name: "content-negotiation",
    category: "Crawl surface",
    tier: "A",
    priority: "medium",
    weight: PRIORITY_WEIGHT.medium,
    fixableByAgent: true,
    scope: "per-page",
    intent:
      "The page serves its Markdown twin via HTTP content negotiation: requesting the HTML URL with Accept: text/markdown, or with a known AI-bot User-Agent (GPTBot etc.), returns markdown instead of the JS-heavy HTML. The cleanest machine-eye view for AI crawlers.",
  },
  {
    name: "ai-delivery-headers",
    category: "Crawl surface",
    tier: "A",
    priority: "low",
    weight: PRIORITY_WEIGHT.low,
    fixableByAgent: true,
    scope: "per-page",
    intent:
      "AEO delivery header contract: the Markdown twin response sets X-Robots-Tag: noindex (no duplicate indexing), Vary: Accept (correct caching), and X-Markdown-Tokens; the HTML response advertises the twin via a Link: rel=\"alternate\"; type=\"text/markdown\" response header.",
  },
  {
    name: "mobile-viewport",
    category: "Rendering",
    tier: "A",
    priority: "low",
    weight: PRIORITY_WEIGHT.low,
    fixableByAgent: true,
    scope: "site-wide",
    intent:
      "Static <meta name=\"viewport\"> is present, responsive (width=device-width), and does not disable zoom. Distinct from mobile-responsive CSS (out of scope).",
  },
];
