import type { Metadata } from "next"

import { SOCIAL_LINKS } from "./navigation"
import { hasMarkdownTwin, markdownTwinPath } from "./twin-paths"

export const SITE = {
  name: "GEO Repair",
  tagline: "AI Search Optimization",
  url: "https://geo.repair",
  description:
    "GEO Repair runs a free AI search audit and checkup report for ChatGPT, Perplexity, and Google AI Overviews, then ships a pull request that fixes it.",
  twitter: "@GeoRepair",
} as const

// Stable, statically-served route from app/opengraph-image.tsx. Referenced
// explicitly because a parent-segment opengraph-image file is NOT merged into
// a page that exports its own `openGraph` object, so every buildMetadata page
// would otherwise ship with no og:image. metadataBase makes this absolute.
const DEFAULT_OG_IMAGE = "/opengraph-image"

type BuildMetadataInput = {
  title?: string
  description?: string
  path?: string
  ogType?: "website" | "article"
  // Root-relative or absolute image URL. Pass `null` to omit images here and
  // defer to a colocated opengraph-image file convention (e.g. blog posts).
  image?: string | null
  noIndex?: boolean
}

export function buildMetadata({
  title,
  description = SITE.description,
  path = "/",
  ogType = "website",
  image = DEFAULT_OG_IMAGE,
  noIndex = false,
}: BuildMetadataInput = {}): Metadata {
  // Titles passed here are complete, length-tuned strings; bypass the root
  // template so we never double the " · GEO Repair" suffix.
  const fullTitle = title ?? `${SITE.name} · ${SITE.tagline}`
  const images = image
    ? [{ url: image, width: 1200, height: 630, alt: fullTitle }]
    : undefined
  // Advertise the page's Markdown twin (rel="alternate" type="text/markdown")
  // so AI crawlers can fetch the clean copy. Only when a twin actually exists.
  const markdownAlternate = hasMarkdownTwin(path)
    ? { types: { "text/markdown": markdownTwinPath(path) } }
    : {}

  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path, ...markdownAlternate },
    openGraph: {
      type: ogType,
      url: path,
      siteName: SITE.name,
      title: fullTitle,
      description,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      site: SITE.twitter,
      creator: SITE.twitter,
      title: fullTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  }
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    logo: new URL("/icon-512.png", SITE.url).toString(),
    description: SITE.description,
    sameAs: SOCIAL_LINKS.map((social) => social.href),
  }
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
  }
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, SITE.url).toString(),
    })),
  }
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  }
}

export function definedTermsJsonLd(terms: { name: string; definition: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "GEO & AEO Glossary",
    hasDefinedTerm: terms.map((term) => ({
      "@type": "DefinedTerm",
      name: term.name,
      description: term.definition,
    })),
  }
}
