import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "@phosphor-icons/react/ssr"

import { buildMetadata, breadcrumbJsonLd, SITE } from "@/lib/seo"
import {
  getAllSlugs,
  getPostBySlug,
  getPostModifiedDate,
  getPostSeoTitle,
} from "@/lib/blog"
import { JsonLd } from "@/components/seo/json-ld"
import { Prose } from "@/components/layout/prose"

export const dynamicParams = false

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}

  return buildMetadata({
    title: getPostSeoTitle(post),
    description: post.description,
    path: `/blog/${post.slug}`,
    ogType: "article",
    // Defer to the colocated opengraph-image.tsx, which renders the per-post card.
    image: null,
  })
}

function articleJsonLd(slug: string) {
  const post = getPostBySlug(slug)
  if (!post) return null
  const url = new URL(`/blog/${post.slug}`, SITE.url).toString()
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    alternativeHeadline: getPostSeoTitle(post),
    description: post.description,
    datePublished: post.date,
    dateModified: getPostModifiedDate(post),
    author: { "@type": "Organization", name: post.author, url: SITE.url },
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      url: SITE.url,
      logo: {
        "@type": "ImageObject",
        url: new URL("/icon-512.png", SITE.url).toString(),
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const { default: Post } = await import(`@/content/blog/${slug}.mdx`)
  const jsonLd = articleJsonLd(slug)

  return (
    <>
      {jsonLd && (
        <JsonLd
          data={[
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Blog", path: "/blog" },
              { name: post.title, path: `/blog/${post.slug}` },
            ]),
            jsonLd,
          ]}
        />
      )}

      <article className="border-t border-border">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-16 sm:px-6">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeftIcon className="size-3.5" aria-hidden />
              All posts
            </Link>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              {post.tags.map((tag) => (
                <span key={tag} className="border border-border px-1.5 py-0.5">
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="font-heading text-3xl font-medium tracking-tight text-balance text-foreground sm:text-4xl">
              {post.title}
            </h1>
            <p className="max-w-xl text-sm/relaxed text-pretty text-muted-foreground">
              {post.description}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              By {post.author}
            </p>
          </div>
        </header>

        {post.thumbnail && (
          <div className="border-b border-border">
            <div className="relative mx-auto aspect-[2/1] max-w-4xl overflow-hidden">
              <Image
                src={post.thumbnail}
                alt=""
                fill
                priority
                sizes="(min-width: 896px) 896px, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <Prose>
            <Post />
          </Prose>
        </div>
      </article>
    </>
  )
}
