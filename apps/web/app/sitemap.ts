import type { MetadataRoute } from "next"

import { getAllPosts, getPostModifiedDate } from "@/lib/blog"
import { SITE } from "@/lib/seo"

const STATIC_ROUTES = [
  "/",
  "/free-geo-tools",
  "/geo-aeo-checker",
  "/security",
  "/pricing",
  "/contact",
  "/blog",
  "/terms",
  "/privacy",
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: new URL(path, SITE.url).toString(),
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }))

  const staticTwinEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => {
    const twinPath = path === "/" ? "/index.md" : `${path}.md`
    return {
      url: new URL(twinPath, SITE.url).toString(),
      lastModified: now,
      changeFrequency: "weekly",
      priority: path === "/" ? 0.8 : 0.5,
    }
  })

  const postEntries: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: new URL(`/blog/${post.slug}`, SITE.url).toString(),
    lastModified: new Date(getPostModifiedDate(post)),
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  const postTwinEntries: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: new URL(`/blog/${post.slug}.md`, SITE.url).toString(),
    lastModified: new Date(getPostModifiedDate(post)),
    changeFrequency: "monthly",
    priority: 0.5,
  }))

  return [...staticEntries, ...staticTwinEntries, ...postEntries, ...postTwinEntries]
}
