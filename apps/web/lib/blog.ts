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
}

// Post metadata lives here (typed, single source); the prose lives in the
// matching content/blog/<slug>.mdx file, imported by the post route. Keeping
// metadata out of MDX frontmatter avoids runtime parsing and keeps the
// listing + sitemap cheap to build.
const POSTS: Post[] = [
  {
    slug: "what-is-ai-search-optimization",
    title: "What Is AI Search Optimization?",
    description:
      "A plain-English definition of AI Search Optimization: how it differs from classic SEO, and the checks that actually move the needle.",
    date: "2026-05-12",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["AI Search", "Fundamentals"],
    author: "GEO Repair",
  },
  {
    slug: "how-ai-crawlers-read-your-site",
    title: "How AI Crawlers Read Your Site",
    description:
      "ChatGPT, Perplexity, and Google AI Overviews fetch your pages differently than a browser. Here's what their crawlers see, and why server-rendered HTML wins.",
    date: "2026-05-26",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["AI Crawlers", "Rendering", "Technical"],
    author: "GEO Repair",
  },
  {
    slug: "ai-search-optimization-checklist",
    title: "AI Search Optimization Checklist for Technical Teams",
    description:
      "A practical checklist for making a site easier for ChatGPT, Perplexity, and Google AI Overviews to fetch, parse, and trust.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["AI Search", "Checklist", "Technical"],
    author: "GEO Repair",
  },
  {
    slug: "increase-ai-citation-chances",
    title: "How to Increase Your Chances of Being Cited in AI Answers",
    description:
      "A realistic answer to a common Reddit question: what content structure, crawlability, and source signals can make a page easier for AI systems to cite.",
    date: "2026-06-03",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["AI Citations", "Answerability", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "traditional-seo-ai-overviews",
    title: "Is Traditional SEO Enough for AI Overviews?",
    description:
      "Traditional SEO still matters, but AI answers reward clearer extraction, entity trust, and sourceable content. Here is where the work changes.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["AI Overviews", "SEO", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "ai-mentions-vs-citations",
    title: "AI Mentions vs AI Citations: What Should You Track?",
    description:
      "A brand mention and a cited URL are not the same signal. Track them separately so you know whether you have awareness, retrieval, or both.",
    date: "2026-06-03",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["Measurement", "AI Citations", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "automated-ai-blog-publishing",
    title: "Should Solo Founders Automate Blog Publishing with AI?",
    description:
      "AI can speed up planning and drafts, but automatic publishing without review creates thin content, duplicate intent, and trust problems.",
    date: "2026-06-03",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["AI Content", "Content Strategy", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "rankings-good-traffic-dropping-ai-search",
    title: "Why Traffic Drops Even When Rankings Look Good",
    description:
      "Stable rankings can hide falling clicks when AI answers satisfy the query on the results page. Diagnose impressions, CTR, and answer visibility together.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["Traffic", "AI Overviews", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "is-ai-search-optimization-just-seo",
    title: "Is AI Search Optimization Just SEO?",
    description:
      "AI Search Optimization is not a replacement for SEO. It is an extra readiness layer focused on extraction, answerability, structured data, and trust.",
    date: "2026-06-03",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["AI Search", "SEO", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "google-search-console-ai-search-gaps",
    title: "What Google Search Console Cannot Tell You About AI Search",
    description:
      "Search Console is still useful, but it does not fully explain ChatGPT, Perplexity, or cross-platform AI recommendations. Here is what to measure beside it.",
    date: "2026-06-03",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["Measurement", "Search Console", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "ai-overviews-organic-traffic",
    title: "Do AI Overviews Kill Organic Traffic?",
    description:
      "AI Overviews can reduce clicks on some informational queries, but the useful question is which pages lose demand and which pages become citation sources.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["AI Overviews", "Traffic", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "chatgpt-perplexity-business-recommendations",
    title: "How to Get Recommended by ChatGPT and Perplexity",
    description:
      "AI recommendations depend on clear entity signals, third-party proof, and category sources. Your homepage is only one part of the recommendation system.",
    date: "2026-06-03",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["AI Recommendations", "Entity Trust", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "ai-search-optimization-tool-checklist",
    title: "What Should an AI Search Optimization Tool Actually Do?",
    description:
      "The useful tool is not another content generator. It should diagnose why a page is invisible, recommend the fix, and verify whether the fix worked.",
    date: "2026-06-03",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["AI Search", "Tools", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "tool-optimize-aeo-seo-geo-website",
    title: "Is There a Tool That Optimizes AEO, SEO, and GEO for My Website?",
    description:
      "Yes, but the useful tool changes the website, not just the score. Here is what an AEO, SEO, and GEO tool should diagnose, fix, and verify.",
    date: "2026-06-05",
    thumbnail: "/images/blog/aeo-seo-geo-tool.jpg",
    tags: ["AEO", "GEO", "Tools"],
    author: "GEO Repair",
  },
  {
    slug: "ai-tool-actually-fixes-aeo-geo-issues",
    title: "Is There an AI Tool That Actually Fixes AEO and GEO Issues?",
    description:
      "Most tools report AI visibility problems. A real fixing tool works at the website source level, opens a pull request, and re-checks the result.",
    date: "2026-06-05",
    thumbnail: "/images/blog/ai-tool-fixes-aeo-geo.jpg",
    tags: ["AEO", "GEO", "Fixes"],
    author: "GEO Repair",
  },
  {
    slug: "aeo-geo-audit-tool-vs-fix-tool",
    title: "AEO and GEO Audit Tools vs Fix Tools: What Is the Difference?",
    description:
      "An audit tool tells you what is wrong. A fix tool changes the website and verifies the blocker was removed. Here is when to use each one.",
    date: "2026-06-05",
    thumbnail: "/images/blog/audit-vs-fix-tools.jpg",
    tags: ["AEO", "GEO", "Tools"],
    author: "GEO Repair",
  },
  {
    slug: "is-seo-worth-it-2026",
    title: "Is SEO Still Worth It in 2026?",
    description:
      "SEO is still worth doing, but the work has shifted from keyword shortcuts toward trust, community proof, useful content, and AI-readable structure.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["SEO", "Strategy", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "ai-content-seo-mistakes",
    title: "The SEO Mistakes Teams Make After Switching to AI Content",
    description:
      "Publishing faster is not a strategy. The common failures are generic drafts, cannibalization, weak review, missing experience, and no sourceable point of view.",
    date: "2026-06-03",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["AI Content", "SEO", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "eeat-ai-search-trust",
    title: "How to Show Experience and Trust in AI Search Content",
    description:
      "Trust is easier to claim than prove. Show real experience through examples, author context, original data, dated updates, and off-site reputation signals.",
    date: "2026-06-03",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["Trust", "Content Quality", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "content-ai-answers-cannot-replace",
    title: "What Content Is Hardest for AI Answers to Replace?",
    description:
      "No content is fully AI-proof, but original data, tools, templates, case studies, and community proof are harder to replace than generic explainers.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["Content Strategy", "AI Search", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "ai-translation-international-seo",
    title: "AI Translation Is Not International SEO",
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
      "How to Write Titles and Meta Descriptions for Google and AI Answers",
    description:
      "The best titles and descriptions are specific, human, and aligned with the first paragraph. Clarity beats keyword stuffing for both search and AI answers.",
    date: "2026-06-03",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["Metadata", "AI Answers", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "topical-authority-ai-search",
    title: "How to Build Topical Authority for AI Search",
    description:
      "Topical authority is less about publishing every keyword variation and more about connected, useful, experience-backed pages that prove real expertise.",
    date: "2026-06-03",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["Topical Authority", "AI Search", "Reddit Questions"],
    author: "GEO Repair",
  },
  {
    slug: "server-rendered-content-ai-search",
    title: "Why Server-Rendered Content Matters for AI Search",
    description:
      "AI search engines can only quote what they can fetch. Learn why server-rendered HTML is the foundation of AI search readiness.",
    date: "2026-06-02",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["Rendering", "AI Crawlers", "Technical"],
    author: "GEO Repair",
  },
  {
    slug: "structured-data-for-ai-search",
    title: "Structured Data for AI Search: What to Add First",
    description:
      "A focused guide to the JSON-LD that helps AI search engines understand articles, organizations, breadcrumbs, products, and FAQs.",
    date: "2026-06-01",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["Structured Data", "JSON-LD", "Technical"],
    author: "GEO Repair",
  },
  {
    slug: "robots-txt-ai-crawlers",
    title: "Robots.txt for AI Crawlers: What to Allow and What to Avoid",
    description:
      "How to keep important pages open to AI crawlers without accidentally exposing private, staging, or low-value surfaces.",
    date: "2026-05-31",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["Crawling", "Robots.txt", "AI Crawlers"],
    author: "GEO Repair",
  },
  {
    slug: "llms-txt-for-ai-search",
    title: "What Is llms.txt and Should Your Website Have One?",
    description:
      "A practical explanation of llms.txt, Markdown twins, and how a curated machine-readable index can support AI search readiness.",
    date: "2026-05-30",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["llms.txt", "Markdown", "AI Search"],
    author: "GEO Repair",
  },
  {
    slug: "answer-first-content-ai-search",
    title: "How to Write Answer-First Content for AI Search",
    description:
      "Question-shaped headings, short direct answers, and evidence-rich sections help AI systems understand what a page is qualified to answer.",
    date: "2026-05-29",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["Content", "Answerability", "AI Search"],
    author: "GEO Repair",
  },
  {
    slug: "ai-search-optimization-for-saas",
    title: "AI Search Optimization for SaaS Websites",
    description:
      "The SaaS pages most likely to be read by AI search engines, and the technical fixes that make pricing, security, and feature pages clearer.",
    date: "2026-05-28",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["SaaS", "AI Search", "Technical"],
    author: "GEO Repair",
  },
  {
    slug: "next-js-ai-search-audit",
    title: "How to Audit a Next.js Site for AI Search Readiness",
    description:
      "A route-by-route audit process for checking rendered HTML, metadata, structured data, crawl files, and content clarity in a Next.js app.",
    date: "2026-05-27",
    thumbnail: "/images/blog/sunset-grass.jpg",
    tags: ["Next.js", "Audit", "Technical"],
    author: "GEO Repair",
  },
  {
    slug: "product-pages-ai-search-readiness",
    title: "Product Page AI Search Readiness Checklist",
    description:
      "How to make product and feature pages easier for AI search engines to understand without stuffing keywords or promising citations.",
    date: "2026-05-25",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["Product Pages", "Checklist", "AI Search"],
    author: "GEO Repair",
  },
  {
    slug: "measure-ai-search-readiness",
    title: "How to Measure AI Search Readiness Before and After a Fix",
    description:
      "A practical measurement framework for tracking crawl visibility, metadata quality, structured data, answerability, and technical readiness.",
    date: "2026-05-24",
    thumbnail: "/images/blog/tulips.jpg",
    tags: ["Measurement", "Audit", "AI Search"],
    author: "GEO Repair",
  },
]

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
