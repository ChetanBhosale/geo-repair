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
    title: "What is AI Search Optimization (GEO/AEO)?",
    description:
      "A plain-English definition of AI Search Optimization, also called GEO or AEO: how it differs from classic SEO, and the checks that actually move the needle.",
    date: "2026-05-12",
    thumbnail: "/images/blog/florals.jpg",
    tags: ["AI Search", "GEO", "AEO", "Fundamentals"],
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
