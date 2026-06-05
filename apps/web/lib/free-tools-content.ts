import type { FaqItem } from "./landing-content"

export const FREE_TOOLS_HEADER = {
  path: "/free-geo-tools",
  metaTitle: "Free GEO tools for AI search optimization",
  metaDescription:
    "Use free GEO tools from GEO Repair to check AI crawler access, raw HTML visibility, metadata, schema, llms.txt, sitemap coverage, and answerability.",
  eyebrow: "Free GEO tools",
  title: "Free GEO tools for AI search readiness",
  description:
    "Run one free scan and get the diagnostics that matter before you spend on AI search software: crawler access, rendered content, metadata, structured data, crawl files, and answerability.",
}

export const FREE_TOOLS = [
  {
    name: "AI search readiness checkup",
    status: "Available now",
    description:
      "Scores a public URL across 23 checks and returns a report with pass, partial, and fail evidence.",
    checks: ["0 to 100 readiness score", "Route-level evidence", "No signup"],
  },
  {
    name: "AI crawler access check",
    status: "Included",
    description:
      "Checks whether important AI and search crawlers can reach the site without blocked robots rules or missing crawl files.",
    checks: ["robots.txt", "sitemap.xml", "AI crawler allow rules"],
  },
  {
    name: "Raw HTML visibility check",
    status: "Included",
    description:
      "Looks at the server response before browser JavaScript runs, because AI crawlers need fetchable text.",
    checks: ["Server-rendered body text", "Visible headings", "Hydration gaps"],
  },
  {
    name: "Metadata and schema check",
    status: "Included",
    description:
      "Reviews titles, descriptions, canonicals, social metadata, and JSON-LD so machines can identify the page cleanly.",
    checks: ["Metadata", "Open Graph", "Structured data"],
  },
  {
    name: "llms.txt and sitemap check",
    status: "Included",
    description:
      "Checks whether crawlers and AI systems have a clean route map for the pages you want them to understand.",
    checks: ["llms.txt", "Markdown twins", "Sitemap coverage"],
  },
  {
    name: "Answerability check",
    status: "Included",
    description:
      "Flags pages that talk around the answer instead of defining the topic in clear, quotable language.",
    checks: ["Answer-first sections", "FAQ structure", "Sourceable claims"],
  },
] as const

export const FREE_TOOLS_COMPARISON = [
  {
    useCase: "You need a quick score",
    guidance:
      "Use a free audit or score checker to understand whether the page is crawlable and structured enough for AI search.",
  },
  {
    useCase: "You need technical evidence",
    guidance:
      "Look for raw HTML, robots, sitemap, metadata, schema, and heading evidence. A vague visibility score is not enough for an engineer.",
  },
  {
    useCase: "You need the site changed",
    guidance:
      "Pick a workflow that turns the scan into a pull request. Most free tools stop at the report.",
  },
] as const

export const FREE_TOOLS_FAQ: FaqItem[] = [
  {
    question: "Are these GEO tools free?",
    answer:
      "Yes. The AI search readiness checkup is free, does not require signup, and returns the diagnostic report for the URL you scan. Paid work starts only if you choose to connect a repository and ask the agent to open fix pull requests.",
  },
  {
    question: "Is this a rank tracker?",
    answer:
      "No. GEO Repair checks whether your site is technically ready for AI search engines to fetch, parse, and quote. Rank trackers and visibility monitors measure whether brands appear in AI answers. Both are useful, but they answer different questions.",
  },
  {
    question: "Can a free GEO tool guarantee ChatGPT citations?",
    answer:
      "No. A tool can remove on-site blockers, but it cannot force ChatGPT, Perplexity, Gemini, Claude, or Google AI Overviews to cite a page. GEO Repair measures readiness and fixes technical issues without promising rankings, citations, or traffic.",
  },
  {
    question: "What makes GEO Repair different from a normal audit tool?",
    answer:
      "The free scan shows the issue and the evidence. The paid fix path can then change the site in a sandbox and open a reviewable pull request. That matters when the problem is code, rendering, metadata, schema, or crawl files.",
  },
]
