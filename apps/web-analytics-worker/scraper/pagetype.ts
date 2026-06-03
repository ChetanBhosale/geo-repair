// Deterministic page-type classifier. Uses signals already parsed into the PageModel:
// JSON-LD @type, og:type, article:* meta, URL section, and structure. No new fetch.
//
// Page type matters for honesty (RUBRIC.md): informational/article pages have a higher AI
// citation ceiling than transactional product/pricing pages.

import type { PageModel, PageType } from "./types.ts";

const ARTICLE_TYPES = /^(blogposting|article|newsarticle|techarticle|scholarlyarticle|report)$/i;
const PRODUCT_TYPES = /^(product|offer|aggregateoffer|softwareapplication)$/i;
const LISTING_TYPES = /^(blog|collectionpage|itemlist|searchresultspage)$/i;

// URL-section signals for page types that carry no useful answer/definition content.
const LEGAL_SEG = /^(privacy|privacy-policy|terms|terms-of-service|tos|legal|cookie|cookies|gdpr|dpa|opt-in|opt-out|disclaimer|eula|acceptable-use|refund|return-policy|compliance)$/;
const UTILITY_SEG = /^(contact|contact-us|login|signin|sign-in|signup|sign-up|register|account|cart|checkout|search|careers|jobs|press|status|sitemap|404|thank-you|thanks|subscribe|unsubscribe|book|demo|get-started|support|help)$/;

function jsonLdTypeMatches(page: PageModel, re: RegExp): boolean {
  return page.jsonLd.some((b) => b.valid && b.types.some((t) => re.test(t)));
}

function section(url: string): string {
  try {
    return new URL(url).pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
  } catch {
    return "";
  }
}

function depth(url: string): number {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).length;
  } catch {
    return 0;
  }
}

/** Classify a single page. Strong schema/meta signals win; URL + structure are tiebreakers. */
export function classifyPage(page: PageModel): PageType {
  const ogType = (page.metaByKey.get("og:type") ?? "").toLowerCase();
  const hasArticleMeta =
    page.metaByKey.has("article:published_time") ||
    page.metaByKey.has("article:author") ||
    page.metaByKey.has("article:tag");
  const seg = section(page.finalUrl);
  const d = depth(page.finalUrl);

  // 0) Legal / utility pages by URL segment. These carry no answer/definition content, so
  //    answerability/definitions/citation-quality are not-applicable on them (not a fail).
  //    Checked early, but explicit Article schema below can still override a mislabeled URL.
  const looksLegal = LEGAL_SEG.test(seg);
  const looksUtility = UTILITY_SEG.test(seg);

  // 1) Documentation (check before article since TechArticle overlaps).
  if (/^(docs|documentation|reference|guide|guides|api)$/.test(seg)) {
    return "documentation";
  }

  // 2) Article: explicit schema, og:type, or article meta (overrides a legal/utility URL guess).
  if (jsonLdTypeMatches(page, ARTICLE_TYPES) || ogType === "article" || hasArticleMeta) {
    return "article";
  }

  if (looksLegal) return "legal";
  if (looksUtility) return "utility";

  // 3) Product: explicit schema or og:type.
  if (jsonLdTypeMatches(page, PRODUCT_TYPES) || ogType === "product") {
    return "product";
  }

  // 4) Listing/collection: explicit schema, or a section index page (depth 1 under a known hub
  //    that also has many internal links).
  if (jsonLdTypeMatches(page, LISTING_TYPES)) return "listing";
  const listingHub = /^(blog|posts|articles|news|glossary|customer-stories|case-studies|resources)$/.test(seg);
  if (listingHub && d <= 1 && page.anchors.length >= 15) return "listing";

  // 5) An item deep inside a content hub with a single H1 + a date reads as an article.
  const h1s = page.headings.filter((h) => h.level === 1).length;
  const hasDate =
    page.metaByKey.has("article:published_time") ||
    /\b(20\d{2}|19\d{2})\b/.test(page.visibleText.slice(0, 1500));
  if (listingHub && d >= 2 && h1s >= 1 && (hasDate || page.wordCount > 400)) {
    return "article";
  }

  return "generic";
}
