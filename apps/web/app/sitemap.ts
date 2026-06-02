import type { MetadataRoute } from "next"

import { getAllPosts } from "@/lib/blog"
import { SITE } from "@/lib/seo"

const STATIC_ROUTES = [
  "/",
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

  const postEntries: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: new URL(`/blog/${post.slug}`, SITE.url).toString(),
    lastModified: new Date(post.updated ?? post.date),
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  return [...staticEntries, ...postEntries]
}
