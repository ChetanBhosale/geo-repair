export type CheckStatus = "pass" | "partial" | "fail"
export type CheckTier = "A" | "B" | "C" | "out-of-scope"

export type RubricCategory =
  | "Rendering"
  | "Structured data"
  | "Metadata"
  | "Crawl surface"
  | "Semantics"
  | "Content"
  | "Answerability"

export const RUBRIC_CATEGORIES: RubricCategory[] = [
  "Rendering",
  "Structured data",
  "Metadata",
  "Crawl surface",
  "Semantics",
  "Content",
  "Answerability",
]

// Intro for the rubric / categories section (shared by the CategoriesGrid
// component and the Markdown twin so the count and copy never drift).
export const CATEGORIES_INTRO = {
  eyebrow: "The rubric",
  title: "23 checks, grouped into 7 categories",
  description:
    "One transparent, versioned rubric powers the free checkup, the agent's fix targets, and the post-merge re-check, so the score you're sold is the score we re-measure.",
} as const

type CategoryMeta = {
  category: RubricCategory
  description: string
  checkCount: number
}

// Human-facing copy for the 7 rubric categories (23 checks total). Counts are
// canonical against RUBRIC.md and must stay in sync with DEMO_CHECKS.
export const CATEGORY_META: CategoryMeta[] = [
  {
    category: "Rendering",
    description:
      "Is your content in the HTML before JavaScript runs? AI crawlers read the raw response, so server-rendered content, a valid doctype, and a declared charset decide whether they see anything at all.",
    checkCount: 3,
  },
  {
    category: "Structured data",
    description:
      "Valid JSON-LD (Organization and WebSite site-wide, Article and BreadcrumbList where they belong) so engines know what each page actually is.",
    checkCount: 1,
  },
  {
    category: "Metadata",
    description:
      "Titles and descriptions sized for the SERP, self-referential canonicals, complete Open Graph and Twitter cards, favicons, and a social image that unfurls.",
    checkCount: 6,
  },
  {
    category: "Crawl surface",
    description:
      "A robots.txt that welcomes GPTBot, ClaudeBot, and PerplexityBot, a valid sitemap, an /llms.txt index, and pages that stay eligible to index.",
    checkCount: 4,
  },
  {
    category: "Semantics",
    description:
      "One H1, a clean heading hierarchy, page landmarks, accurate alt text, and an accessible name on every control: the machine-eye view of your page.",
    checkCount: 3,
  },
  {
    category: "Content",
    description:
      "Descriptive internal links, visible dates and authorship, citations to trusted sources, and a clean Markdown twin of every page: the signals that correlate with getting quoted.",
    checkCount: 4,
  },
  {
    category: "Answerability",
    description:
      "Question-shaped headings, answer-first writing, and defined terms an AI engine can lift straight into a response.",
    checkCount: 2,
  },
]

const STATUS_LABEL: Record<CheckStatus, string> = {
  pass: "Pass",
  partial: "Partial",
  fail: "Fail",
}

export function statusLabel(status: CheckStatus): string {
  return STATUS_LABEL[status]
}
