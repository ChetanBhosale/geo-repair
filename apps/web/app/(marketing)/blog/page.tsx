import Link from "next/link"
import { ArrowRightIcon } from "@phosphor-icons/react/ssr"

import { buildMetadata, breadcrumbJsonLd, SITE } from "@/lib/seo"
import { getAllPosts, type Post } from "@/lib/blog"
import { JsonLd } from "@/components/seo/json-ld"
import { PageHeader } from "@/components/layout/page-header"
import { HalftoneImage } from "@/components/shaders/halftone-image"
import { CornerMarks } from "@/components/sections/frame"
import { Section } from "@/components/sections/section"

export const metadata = buildMetadata({
  title: "Blog · AI Search Optimization Guides · GEO Repair",
  description:
    "Plain-English guides to AI Search Optimization: how AI crawlers read your site, which technical checks matter, and how to make pages legible to ChatGPT, Perplexity, and AI Overviews.",
  path: "/blog",
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}

// Real thumbnail when present; deterministic initials card otherwise.
function Thumb({ post }: { post: Post }) {
  if (post.thumbnail) {
    return (
      <div className="relative aspect-[16/9] overflow-hidden border-b border-border">
        <HalftoneImage
          src={post.thumbnail}
          className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
    )
  }
  const initials = post.tags[0]?.slice(0, 2).toUpperCase() ?? "GR"
  return (
    <div
      aria-hidden
      className="flex aspect-[16/9] items-center justify-center border-b border-border bg-muted/40"
    >
      <span className="font-heading text-2xl font-medium tracking-tight text-muted-foreground">
        {initials}
      </span>
    </div>
  )
}

function blogJsonLd(posts: Post[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: `${SITE.name} Blog`,
    url: new URL("/blog", SITE.url).toString(),
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updated ?? post.date,
      author: { "@type": "Organization", name: post.author },
      url: new URL(`/blog/${post.slug}`, SITE.url).toString(),
    })),
  }
}

export default function BlogPage() {
  const posts = getAllPosts()

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
          ]),
          blogJsonLd(posts),
        ]}
      />

      <PageHeader
        eyebrow="Blog"
        title="Notes on AI Search Optimization"
        description="Honest, technical guides to making your site legible to AI search engines: no hype, no citation guarantees, just what's in your control."
      />

      <Section>
        {posts.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            New posts are on the way.
          </p>
        ) : (
          <ul className="relative mx-auto grid max-w-5xl gap-px border border-border bg-border sm:grid-cols-2">
            <CornerMarks />
            {posts.map((post) => (
              <li key={post.slug} className="bg-card">
                <article className="flex h-full flex-col">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="group flex h-full flex-col focus-visible:outline-none"
                  >
                    <Thumb post={post} />
                    <div className="flex flex-1 flex-col gap-3 p-6">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                        <time dateTime={post.date}>
                          {formatDate(post.date)}
                        </time>
                        {post.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="border border-border px-1.5 py-0.5"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h2 className="font-heading text-lg font-medium tracking-tight text-balance text-foreground group-hover:underline group-hover:underline-offset-4">
                        {post.title}
                      </h2>
                      <p className="text-sm/relaxed text-pretty text-muted-foreground">
                        {post.description}
                      </p>
                      <span className="mt-auto inline-flex items-center gap-1.5 pt-2 font-mono text-xs text-foreground">
                        Read post
                        <ArrowRightIcon
                          className="size-3.5 transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </span>
                    </div>
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}
