import type { PageModel } from "./parser";
import type { BrandIdentity } from "./types";

type JsonRecord = Record<string, unknown>;

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim() ?? "";
  return cleaned || null;
}

function absoluteUrl(value: string | null | undefined, baseUrl: string): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;

  try {
    const url = new URL(cleaned, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function imageFromLogo(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as JsonRecord;
  if (typeof record.url === "string") return record.url;
  if (typeof record.contentUrl === "string") return record.contentUrl;
  return null;
}

function jsonLdItems(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.flatMap(jsonLdItems);
  if (!value || typeof value !== "object") return [];

  const record = value as JsonRecord;
  const graph = record["@graph"];
  return [record, ...(Array.isArray(graph) ? graph.flatMap(jsonLdItems) : [])];
}

function jsonLdBrand(page: PageModel): {
  name: string | null;
  logoUrl: string | null;
} {
  const scripts =
    page.rawHtml.match(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ) ?? [];

  for (const script of scripts) {
    const body = script
      .replace(/^<script[^>]*>/i, "")
      .replace(/<\/script>$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(body) as unknown;
      const candidate = jsonLdItems(parsed).find((item) => {
        const type = item["@type"];
        const types = Array.isArray(type) ? type : type ? [type] : [];
        return types.some((t) =>
          ["Organization", "LocalBusiness", "WebSite"].includes(String(t)),
        );
      });
      if (!candidate) continue;

      return {
        name: cleanText(
          typeof candidate.name === "string" ? candidate.name : null,
        ),
        logoUrl: absoluteUrl(imageFromLogo(candidate.logo), page.finalUrl),
      };
    } catch {
      continue;
    }
  }

  return { name: null, logoUrl: null };
}

function bestLink(page: PageModel, predicate: (rel: string) => boolean): string | null {
  const links = page.links
    .filter((link) => link.href && predicate(link.rel ?? ""))
    .map((link) => ({
      href: link.href!,
      size: Number(link.sizes?.match(/\d+/)?.[0] ?? 0),
    }))
    .sort((a, b) => b.size - a.size);

  return absoluteUrl(links[0]?.href, page.finalUrl);
}

export function detectBrandIdentity(page: PageModel): BrandIdentity {
  const jsonLd = jsonLdBrand(page);
  const appleTouchIcon = bestLink(page, (rel) => rel.includes("apple-touch-icon"));
  const explicitFavicon =
    bestLink(
      page,
      (rel) => rel.includes("icon") && !rel.includes("apple-touch-icon"),
    ) ?? absoluteUrl("/favicon.ico", page.finalUrl);

  return {
    name:
      jsonLd.name ??
      cleanText(page.metaByKey.get("og:site_name")) ??
      cleanText(page.metaByKey.get("application-name")) ??
      null,
    faviconUrl: explicitFavicon,
    logoUrl:
      jsonLd.logoUrl ??
      absoluteUrl(page.metaByKey.get("og:logo"), page.finalUrl) ??
      appleTouchIcon,
  };
}
