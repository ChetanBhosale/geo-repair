import type { PageModel } from "./parser";

export type PageType =
  | "article"
  | "listing"
  | "product"
  | "documentation"
  | "legal"
  | "utility"
  | "generic";

const ARTICLE_TYPES = /^(blogposting|article|newsarticle|techarticle|scholarlyarticle|report)$/i;
const PRODUCT_TYPES = /^(product|offer|aggregateoffer|softwareapplication)$/i;
const LISTING_TYPES = /^(blog|collectionpage|itemlist|searchresultspage)$/i;

const LEGAL_SEG = /^(privacy|privacy-policy|terms|terms-of-service|tos|legal|cookie|cookies|gdpr|dpa|disclaimer|eula|refund|return-policy|compliance)$/;
const UTILITY_SEG = /^(contact|contact-us|login|signin|sign-in|signup|sign-up|register|account|cart|checkout|search|careers|jobs|press|status|404|thank-you|subscribe|unsubscribe|book|demo|get-started|support|help)$/;

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

export function classifyPage(page: PageModel): PageType {
  const ogType = (page.metaByKey.get("og:type") ?? "").toLowerCase();
  const hasArticleMeta =
    page.metaByKey.has("article:published_time") ||
    page.metaByKey.has("article:author") ||
    page.metaByKey.has("article:tag");
  const seg = section(page.finalUrl);
  const d = depth(page.finalUrl);

  if (/^(docs|documentation|reference|guide|guides|api)$/.test(seg)) return "documentation";

  if (jsonLdTypeMatches(page, ARTICLE_TYPES) || ogType === "article" || hasArticleMeta) {
    return "article";
  }

  if (LEGAL_SEG.test(seg)) return "legal";
  if (UTILITY_SEG.test(seg)) return "utility";

  if (jsonLdTypeMatches(page, PRODUCT_TYPES) || ogType === "product") return "product";

  if (jsonLdTypeMatches(page, LISTING_TYPES)) return "listing";
  const listingHub = /^(blog|posts|articles|news|glossary|customer-stories|case-studies|resources)$/.test(seg);
  if (listingHub && d <= 1 && page.anchors.length >= 15) return "listing";

  const hasDate = page.metaByKey.has("article:published_time") || /\b(20\d{2}|19\d{2})\b/.test(page.visibleText.slice(0, 1500));
  if (listingHub && d >= 2 && page.h1Count >= 1 && (hasDate || page.wordCount > 400)) return "article";

  return "generic";
}
