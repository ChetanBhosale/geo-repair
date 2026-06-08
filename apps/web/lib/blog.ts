export type Post = {
  slug: string
  title: string
  description: string
  date: string
  updated?: string
  thumbnail?: string
  tags: string[]
  author: string
  draft?: boolean
  definedTerms?: { name: string; definition: string }[]
}

export const BLOG_SEO_METADATA_UPDATED = "2026-06-05"

// Post metadata lives here (typed, single source); the prose lives in the
// matching content/blog/<slug>.mdx file, imported by the post route. Keeping
// metadata out of MDX frontmatter avoids runtime parsing and keeps the
// listing + sitemap cheap to build.
const POSTS: Post[] = [
  {
    slug: "free-geo-tools-2026",
    title: "Free GEO tools in 2026: what to use before you pay",
    description:
      "A practical guide to free GEO tools for AI search audits, content scoring, crawler checks, llms.txt, visibility monitoring, and fix workflows.",
    date: "2026-06-05",
    thumbnail: "/images/blog/free-geo-tools-2026.jpg",
    tags: ["GEO", "Tools", "AI Search"],
    author: "GEO Repair",
  },
  {
    slug: "what-is-ai-search-optimization",
    title: "What is AI search optimization?",
    description:
      "A plain-English definition of AI Search Optimization: how it differs from classic SEO, and the checks that actually move the needle.",
    date: "2026-05-12",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["AI Search", "Fundamentals"],
    author: "GEO Repair",
    definedTerms: [
      {
        name: "AI Search Optimization",
        definition:
          "AI Search Optimization is the practice of making a website easy for AI search engines like ChatGPT, Perplexity, Google AI Overviews, and Claude to read, understand, and quote accurately.",
      },
    ],
  },
  {
    slug: "how-ai-crawlers-read-your-site",
    title: "How AI crawlers read your site",
    description:
      "ChatGPT, Perplexity, and Google AI Overviews fetch your pages differently than a browser. Here's what their crawlers see, and why server-rendered HTML wins.",
    date: "2026-05-26",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["AI Crawlers", "Rendering", "Technical"],
    author: "GEO Repair",
  },
  {
    slug: "ai-search-optimization-checklist",
    title: "AI search optimization checklist for technical teams",
    description:
      "A practical checklist for making a site easier for ChatGPT, Perplexity, and Google AI Overviews to fetch, parse, and trust.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["AI Search", "Checklist", "Technical"],
    author: "GEO Repair",
  },
  {
    slug: "increase-ai-citation-chances",
    title: "How to increase your chances of being cited in AI answers",
    description:
      "A realistic answer to a common Reddit question: what content structure, crawlability, and source signals can make a page easier for AI systems to cite.",
    date: "2026-06-03",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["AI Citations", "Answerability", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "traditional-seo-ai-overviews",
    title: "Is traditional SEO enough for AI Overviews?",
    description:
      "Traditional SEO still matters, but AI answers reward clearer extraction, entity trust, and sourceable content. Here is where the work changes.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["AI Overviews", "SEO", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "ai-mentions-vs-citations",
    title: "AI mentions vs AI citations: what should you track?",
    description:
      "A brand mention and a cited URL are not the same signal. Track them separately so you know whether you have awareness, retrieval, or both.",
    date: "2026-06-03",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["Measurement", "AI Citations", "Reddit Questions"],
    author: "GEO Repair",
    definedTerms: [
      {
        name: "AI mention",
        definition: "A mention means an AI answer names your brand.",
      },
      {
        name: "AI citation",
        definition: "An AI citation is a linked source.",
      },
    ],
  },
  {
    slug: "automated-ai-blog-publishing",
    title: "Should solo founders automate blog publishing with AI?",
    description:
      "AI can speed up planning and drafts, but automatic publishing without review creates thin content, duplicate intent, and trust problems.",
    date: "2026-06-03",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["AI Content", "Content Strategy", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "rankings-good-traffic-dropping-ai-search",
    title: "Why traffic drops even when rankings look good",
    description:
      "Stable rankings can hide falling clicks when AI answers satisfy the query on the results page. Diagnose impressions, CTR, and answer visibility together.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["Traffic", "AI Overviews", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "is-ai-search-optimization-just-seo",
    title: "Is AI search optimization just SEO?",
    description:
      "AI Search Optimization is not a replacement for SEO. It is an extra readiness layer focused on extraction, answerability, structured data, and trust.",
    date: "2026-06-03",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["AI Search", "SEO", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "google-search-console-ai-search-gaps",
    title: "What Google Search Console cannot tell you about AI search",
    description:
      "Search Console is still useful, but it does not fully explain ChatGPT, Perplexity, or cross-platform AI recommendations. Here is what to measure beside it.",
    date: "2026-06-03",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["Measurement", "Search Console", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "ai-overviews-organic-traffic",
    title: "Do AI Overviews kill organic traffic?",
    description:
      "AI Overviews can reduce clicks on some informational queries, but the useful question is which pages lose demand and which pages become citation sources.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["AI Overviews", "Traffic", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "chatgpt-perplexity-business-recommendations",
    title: "How to get recommended by ChatGPT and Perplexity",
    description:
      "AI recommendations depend on clear entity signals, third-party proof, and category sources. Your homepage is only one part of the recommendation system.",
    date: "2026-06-03",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["AI Recommendations", "Entity Trust", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "ai-search-optimization-tool-checklist",
    title: "AI search tool checklist: audit, scan, report, fix",
    description:
      "What an AI search tool should cover: GEO, AEO, answer engine optimization, scans, reports, fixes, and verification.",
    date: "2026-06-03",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["AI Search", "Tools", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "tool-optimize-aeo-seo-geo-website",
    title: "Free GEO and AEO scan with audit report",
    description:
      "How to judge answer engine optimization and generative engine optimization tools: what a free scan should diagnose, how the checkup score should read, and what the report should fix.",
    date: "2026-06-05",
    thumbnail: "/images/blog/aeo-seo-geo-tool.jpg",
    tags: ["AEO", "GEO", "Tools"],
    author: "GEO Repair",
  },
  {
    slug: "ai-tool-actually-fixes-aeo-geo-issues",
    title: "Free AEO audit: can AI fix GEO issues?",
    description:
      "A free AEO audit can find answer engine optimization and generative engine optimization problems. A repair-grade AI tool fixes them at the source.",
    date: "2026-06-05",
    thumbnail: "/images/blog/ai-tool-fixes-aeo-geo.jpg",
    tags: ["AEO", "GEO", "Fixes"],
    author: "GEO Repair",
  },
  {
    slug: "aeo-geo-audit-tool-vs-fix-tool",
    title: "Free AEO and GEO audit tools vs fix tools",
    description:
      "A free AEO audit, GEO scan, or checkup report tells you what's wrong. A fix tool changes the website and verifies the blocker was removed.",
    date: "2026-06-05",
    thumbnail: "/images/blog/audit-vs-fix-tools.jpg",
    tags: ["AEO", "GEO", "Tools"],
    author: "GEO Repair",
  },
  {
    slug: "is-seo-worth-it-2026",
    title: "Is SEO still worth it in 2026?",
    description:
      "SEO is still worth doing, but the work has shifted from keyword shortcuts toward trust, community proof, useful content, and structure AI systems can read.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["SEO", "Strategy", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "ai-content-seo-mistakes",
    title: "The SEO mistakes teams make after switching to AI content",
    description:
      "Publishing faster is not a strategy. The common failures are generic drafts, cannibalization, weak review, missing experience, and no sourceable point of view.",
    date: "2026-06-03",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["AI Content", "SEO", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "eeat-ai-search-trust",
    title: "How to show experience and trust in AI search content",
    description:
      "Trust is easier to claim than prove. Show real experience through examples, author context, original data, dated updates, and off-site reputation signals.",
    date: "2026-06-03",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["Trust", "Content Quality", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "content-ai-answers-cannot-replace",
    title: "What content is hardest for AI answers to replace?",
    description:
      "No content is fully AI-proof, but original data, tools, templates, case studies, and community proof are harder to replace than generic explainers.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["Content Strategy", "AI Search", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "ai-translation-international-seo",
    title: "AI translation is not international SEO",
    description:
      "AI translation can make localization faster, but international SEO still needs local intent research, hreflang accuracy, market examples, and human review.",
    date: "2026-06-03",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["International SEO", "Localization", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "titles-meta-descriptions-ai-answers",
    title:
      "How to write titles and meta descriptions for Google and AI answers",
    description:
      "The best titles and descriptions are specific, human, and aligned with the first paragraph. Clarity beats keyword stuffing for both search and AI answers.",
    date: "2026-06-03",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["Metadata", "AI Answers", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "topical-authority-ai-search",
    title: "How to build topical authority for AI search",
    description:
      "Topical authority is less about publishing every keyword variation and more about connected, useful, experience-backed pages that prove real expertise.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["Topical Authority", "AI Search", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "server-rendered-content-ai-search",
    title: "Why server-rendered content matters for AI search",
    description:
      "AI search engines can only quote what they can fetch. Server-rendered HTML gives them the page before JavaScript runs.",
    date: "2026-06-02",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["Rendering", "AI Crawlers", "Technical"],
    author: "GEO Repair",
    definedTerms: [
      {
        name: "Server-rendered content",
        definition:
          "Server-rendered content is the foundation of AI search readiness because it gives crawlers the full page before JavaScript has to do any work.",
      },
    ],
  },
  {
    slug: "structured-data-for-ai-search",
    title: "Structured data for AI search: what to add first",
    description:
      "A focused guide to the JSON-LD that helps AI search engines understand articles, organizations, breadcrumbs, products, and FAQs.",
    date: "2026-06-01",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["Structured Data", "JSON-LD", "Technical"],
    author: "GEO Repair",
    definedTerms: [
      {
        name: "Structured data",
        definition:
          "Structured data helps AI search engines understand what a page is, who published it, when it changed, and which facts belong together.",
      },
    ],
  },
  {
    slug: "robots-txt-ai-crawlers",
    title: "Robots.txt for AI crawlers: what to allow and what to avoid",
    description:
      "How to keep important pages open to AI crawlers without accidentally exposing private, staging, or low-value surfaces.",
    date: "2026-05-31",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["Crawling", "Robots.txt", "AI Crawlers"],
    author: "GEO Repair",
  },
  {
    slug: "llms-txt-for-ai-search",
    title: "What is llms.txt and should your website have one?",
    description:
      "A practical explanation of llms.txt, Markdown twins, and how a curated index can help AI systems find the right pages.",
    date: "2026-05-30",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["llms.txt", "Markdown", "AI Search"],
    author: "GEO Repair",
    definedTerms: [
      {
        name: "llms.txt",
        definition:
          "llms.txt is a plain-text index that points AI systems to the pages and Markdown resources you most want them to read.",
      },
      {
        name: "Markdown twin",
        definition:
          "A Markdown twin is a clean text version of a page served at a predictable URL, often by appending .md to the route.",
      },
    ],
  },
  {
    slug: "answer-first-content-ai-search",
    title: "How to write answer-first content for AI search",
    description:
      "Question-shaped headings, short direct answers, and evidence-rich sections help AI systems understand what a page is qualified to answer.",
    date: "2026-05-29",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["Content", "Answerability", "AI Search"],
    author: "GEO Repair",
    definedTerms: [
      {
        name: "AI Search Optimization",
        definition:
          "AI Search Optimization is the practice of making a website easier for AI search engines to fetch, understand, and cite accurately.",
      },
    ],
  },
  {
    slug: "ai-search-optimization-for-saas",
    title: "AI search optimization for SaaS websites",
    description:
      "The SaaS pages most likely to be read by AI search engines, and the technical fixes that make pricing, security, and feature pages clearer.",
    date: "2026-05-28",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["SaaS", "AI Search", "Technical"],
    author: "GEO Repair",
  },
  {
    slug: "next-js-ai-search-audit",
    title: "Next.js AI search audit with scan report",
    description:
      "A route-by-route audit and checkup process for rendered HTML, metadata, structured data, crawl files, and content clarity in Next.js.",
    date: "2026-05-27",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["Next.js", "Audit", "Technical"],
    author: "GEO Repair",
  },
  {
    slug: "product-pages-ai-search-readiness",
    title: "Product page AI search readiness checklist",
    description:
      "How to make product and feature pages easier for AI search engines to understand without stuffing keywords or promising citations.",
    date: "2026-05-25",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["Product Pages", "Checklist", "AI Search"],
    author: "GEO Repair",
  },
  {
    slug: "measure-ai-search-readiness",
    title: "AI search readiness report: what to measure",
    description:
      "What an audit report should measure before and after a fix: crawl visibility, metadata quality, structured data, answerability, and readiness.",
    date: "2026-05-24",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["Measurement", "Audit", "AI Search"],
    author: "GEO Repair",
  },
]

const SEO_TITLES_BY_SLUG: Record<string, string> = {
  "free-geo-tools-2026":
    "Free GEO tools in 2026: choose audits before paid platforms | GEO Repair",
  "what-is-ai-search-optimization":
    "What is AI search optimization? Fix crawl blockers | GEO Repair",
  "how-ai-crawlers-read-your-site":
    "How AI crawlers read your site: expose HTML | GEO Repair",
  "ai-search-optimization-checklist":
    "AI search checklist: fix crawl, schema, and answers | GEO Repair",
  "increase-ai-citation-chances":
    "Increase AI citation chances with sourceable pages | GEO Repair",
  "traditional-seo-ai-overviews":
    "Traditional SEO for AI Overviews: keep clicks | GEO Repair",
  "ai-mentions-vs-citations":
    "AI mentions vs citations: track the right signal | GEO Repair",
  "automated-ai-blog-publishing":
    "AI blog automation: avoid thin content risks | GEO Repair",
  "rankings-good-traffic-dropping-ai-search":
    "Traffic dropping despite rankings? Fix AI CTR loss | GEO Repair",
  "is-ai-search-optimization-just-seo":
    "Is AI search optimization just SEO? Add crawl fixes | GEO Repair",
  "google-search-console-ai-search-gaps":
    "Google Search Console gaps for AI search | GEO Repair",
  "ai-overviews-organic-traffic":
    "Do AI Overviews kill organic traffic? Find pages losing clicks | GEO Repair",
  "chatgpt-perplexity-business-recommendations":
    "Get recommended by ChatGPT with stronger entity signals | GEO Repair",
  "ai-search-optimization-tool-checklist":
    "AI search tool checklist: audit, scan, report, fix, and verify | GEO Repair",
  "tool-optimize-aeo-seo-geo-website":
    "Free GEO and AEO scan: check your website before buying tools | GEO Repair",
  "ai-tool-actually-fixes-aeo-geo-issues":
    "Free AEO audit: find GEO issues, then fix them in code | GEO Repair",
  "aeo-geo-audit-tool-vs-fix-tool":
    "Free AEO and GEO audit tools vs fix tools | GEO Repair",
  "is-seo-worth-it-2026":
    "Is SEO worth it in 2026? Build trust and AI-readable pages | GEO Repair",
  "ai-content-seo-mistakes":
    "AI content SEO mistakes: avoid generic drafts | GEO Repair",
  "eeat-ai-search-trust":
    "E-E-A-T for AI search: prove experience, sources, and trust | GEO Repair",
  "content-ai-answers-cannot-replace":
    "Content AI answers cannot replace: tools, data, proof | GEO Repair",
  "ai-translation-international-seo":
    "AI translation for SEO: add hreflang and local intent | GEO Repair",
  "titles-meta-descriptions-ai-answers":
    "Titles and descriptions for AI answers: clearer snippets | GEO Repair",
  "topical-authority-ai-search":
    "Topical authority for AI search: connect expert pages | GEO Repair",
  "server-rendered-content-ai-search":
    "Server-rendered content for AI search: expose HTML | GEO Repair",
  "structured-data-for-ai-search":
    "Structured data for AI search: match JSON-LD to pages | GEO Repair",
  "robots-txt-ai-crawlers":
    "Robots.txt for AI crawlers: allow useful pages and block noise | GEO Repair",
  "llms-txt-for-ai-search":
    "llms.txt for AI search: publish a clean site map | GEO Repair",
  "answer-first-content-ai-search":
    "Answer-first content for AI search: write quotable sections | GEO Repair",
  "ai-search-optimization-for-saas":
    "AI search for SaaS: fix pricing and security pages | GEO Repair",
  "next-js-ai-search-audit":
    "Next.js AI search audit: fix rendering and metadata | GEO Repair",
  "product-pages-ai-search-readiness":
    "Product page AI search checklist: clarify features | GEO Repair",
  "measure-ai-search-readiness":
    "AI search readiness report: measure crawl and schema | GEO Repair",
}

function latestIsoDate(a: string, b: string): string {
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

export function getAllPosts(): Post[] {
  return POSTS.filter((post) => !post.draft).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

export function getPostBySlug(slug: string): Post | undefined {
  const post = POSTS.find((p) => p.slug === slug)
  return post && !post.draft ? post : undefined
}

export function getAllSlugs(): string[] {
  return getAllPosts().map((post) => post.slug)
}

export function getPostSeoTitle(post: Post): string {
  return SEO_TITLES_BY_SLUG[post.slug] ?? `${post.title} | GEO Repair`
}

export function getPostModifiedDate(post: Post): string {
  return latestIsoDate(post.updated ?? post.date, BLOG_SEO_METADATA_UPDATED)
}
