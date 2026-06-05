// Page discovery + smart selection for a multi-page checkup.
//
// Goal: from one input URL, decide which pages to actually check so we judge a site on a
// representative sample, not a single page, and never crawl all 100+ blog posts.
//
// Strategy (cheapest, most reliable first):
//   1. Seed from sitemap.xml (expanding a sitemap-index one level) when available.
//   2. Otherwise fall back to a shallow same-origin link crawl of the homepage.
//   3. Classify URLs into "sections" by their first path segment (/, /pricing, /blog, ...).
//   4. Select a representative set: always the homepage + key top-level pages, then at most a
//      few samples per large section (so /blog with 500 posts contributes ~2-3, not 500).

import { rawFetch, type FetchOptions } from "./fetcher.ts";

export interface DiscoveryResult {
  /** The pages we will actually check, in priority order (homepage first). */
  selected: string[];
  /** Where the candidate URLs came from. */
  source: "sitemap" | "sitemap-index" | "homepage-links" | "single";
  /** Total candidate URLs discovered before selection (for transparency). */
  totalDiscovered: number;
  /** Per-section counts among the candidates, e.g. { "/": 1, "/blog": 412, "/pricing": 1 }. */
  sections: Record<string, number>;
  /** Candidate URLs that existed but were NOT selected (capped sample, for the report). */
  skippedSample: string[];
}

export interface DiscoveryOptions extends FetchOptions {
  /** Hard cap on pages to check. Default Infinity. */
  maxPages?: number;
  /** Max pages sampled from any single large section. Default Infinity (no per-section cap). */
  maxPerSection?: number;
}

const DEFAULT_MAX_PAGES = Infinity;
const DEFAULT_MAX_PER_SECTION = Infinity;
const SITEMAP_URL_CAP = 50_000; // sitemap protocol per-file limit; safety bound on memory
const SITEMAP_INDEX_CHILD_CAP = 50; // expand up to N child sitemaps from an index

/** Extract <loc> values from a sitemap or sitemap-index XML body. */
function extractLocs(xml: string, cap: number): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null && out.length < cap) {
    const loc = (m[1] ?? "").trim();
    if (loc) out.push(loc.replace(/&amp;/g, "&"));
  }
  return out;
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

function sectionOf(pathname: string): string {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg ? `/${seg.toLowerCase()}` : "/";
}

function depthOf(url: string): number {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).length;
  } catch {
    return 99;
  }
}

// Known high-value top-level pages. When present, these are checked before other depth-1 pages
// so a commercial page like /pricing is never crowded out by alphabetical luck.
const PRIORITY_SLUGS = [
  "pricing",
  "price",
  "plans",
  "features",
  "product",
  "products",
  "solutions",
  "platform",
  "about",
  "about-us",
  "contact",
  "contact-us",
  "services",
  "use-cases",
  "how-it-works",
];

function priorityRank(url: string): number {
  try {
    const seg =
      new URL(url).pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
    const idx = PRIORITY_SLUGS.indexOf(seg);
    return idx === -1 ? PRIORITY_SLUGS.length : idx;
  } catch {
    return PRIORITY_SLUGS.length;
  }
}

/**
 * Pull a candidate URL list from the sitemap (expanding an index one level deep), same-origin only.
 * Returns null when no usable sitemap exists.
 */
export async function urlsFromSitemap(
  origin: string,
  sitemapUrl: string,
  options: FetchOptions = {},
): Promise<{ urls: string[]; source: "sitemap" | "sitemap-index" } | null> {
  const res = await rawFetch(sitemapUrl, options);
  if (!res.ok || !res.body) return null;
  const looksXml =
    res.contentType.includes("xml") ||
    res.body.trimStart().startsWith("<?xml") ||
    res.body.includes("<urlset") ||
    res.body.includes("<sitemapindex");
  if (!looksXml) return null;

  const sameOrigin = (u: string): boolean => {
    try {
      return new URL(u).origin === origin;
    } catch {
      return false;
    }
  };

  if (isSitemapIndex(res.body)) {
    const childSitemaps = extractLocs(res.body, SITEMAP_INDEX_CHILD_CAP);
    const all: string[] = [];
    for (const child of childSitemaps) {
      if (all.length >= SITEMAP_URL_CAP) break;
      const childRes = await rawFetch(child, options);
      if (childRes.ok && childRes.body) {
        all.push(...extractLocs(childRes.body, SITEMAP_URL_CAP - all.length));
      }
    }
    const urls = [...new Set(all)].filter(sameOrigin);
    return urls.length ? { urls, source: "sitemap-index" } : null;
  }

  const urls = [...new Set(extractLocs(res.body, SITEMAP_URL_CAP))].filter(
    sameOrigin,
  );
  return urls.length ? { urls, source: "sitemap" } : null;
}

/** Shallow fallback: same-origin links found in the homepage HTML. */
export function urlsFromHomepageLinks(
  homepageHtml: string,
  origin: string,
): string[] {
  const out = new Set<string>();
  const re = /<a\b[^>]*\bhref=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(homepageHtml)) !== null) {
    const href = m[1];
    if (!href) continue;
    if (/^(mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    try {
      const u = new URL(href, origin);
      u.hash = "";
      if (
        u.origin === origin &&
        (u.protocol === "https:" || u.protocol === "http:")
      ) {
        out.add(u.toString());
      }
    } catch {
      /* ignore malformed href */
    }
  }
  return [...out];
}

/** Normalize: strip trailing slash (except root), drop obvious non-HTML asset URLs. */
function normalize(url: string): string | null {
  try {
    const u = new URL(url);
    u.hash = "";
    if (
      /\.(xml|json|txt|pdf|jpe?g|png|gif|svg|webp|ico|css|js|mp4|zip|rss)$/i.test(
        u.pathname,
      )
    ) {
      return null;
    }
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/\/+$/, "");
    }
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Select a representative sample from candidate URLs.
 * Priority order:
 *   1. Homepage (always first).
 *   2. All depth-1 top-level pages (e.g. /pricing, /features, /about), priority slugs first.
 *      These are the pages a human judges a site by, so they come before any deep content.
 *   3. A capped, round-robin sample from deep multi-page sections (e.g. /blog/*, /glossary/*),
 *      so a section with 500 posts contributes only maxPerSection, never dominates.
 */
export function selectRepresentative(
  homepage: string,
  candidates: string[],
  opts: { maxPages: number; maxPerSection: number },
): {
  selected: string[];
  sections: Record<string, number>;
  skippedSample: string[];
} {
  const homeUrl = normalize(homepage) ?? homepage;

  const seen = new Set<string>();
  const bySection = new Map<string, string[]>();
  const sections: Record<string, number> = {};
  const topLevel: string[] = []; // depth-1 pages across all sections

  for (const raw of candidates) {
    const url = normalize(raw);
    if (!url || seen.has(url) || url === homeUrl) continue;
    seen.add(url);
    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      continue;
    }
    const section = sectionOf(pathname);
    sections[section] = (sections[section] ?? 0) + 1;
    if (!bySection.has(section)) bySection.set(section, []);
    bySection.get(section)!.push(url);
    if (depthOf(url) <= 1) topLevel.push(url);
  }

  // Within each section, shallowest + shortest first (so /blog beats /blog/some-post).
  for (const list of bySection.values()) {
    list.sort((a, b) => depthOf(a) - depthOf(b) || a.length - b.length);
  }

  const selected: string[] = [homeUrl];
  const selectedSet = new Set<string>([homeUrl]);

  // Phase 2: every depth-1 top-level page, priority slugs first then alphabetical.
  topLevel.sort(
    (a, b) => priorityRank(a) - priorityRank(b) || a.localeCompare(b),
  );
  for (const u of topLevel) {
    if (selected.length >= opts.maxPages) break;
    if (!selectedSet.has(u)) {
      selected.push(u);
      selectedSet.add(u);
    }
  }

  // Phase 3: round-robin deeper pages from sections, capped per section, largest sections first.
  const deepSections = [...bySection.keys()]
    .filter((s) => s !== "/")
    .sort(
      (a, b) =>
        bySection.get(b)!.length - bySection.get(a)!.length ||
        a.localeCompare(b),
    );
  const perSectionTaken = new Map<string, number>();
  let progress = true;
  while (selected.length < opts.maxPages && progress) {
    progress = false;
    for (const section of deepSections) {
      if (selected.length >= opts.maxPages) break;
      const taken = perSectionTaken.get(section) ?? 0;
      if (taken >= opts.maxPerSection) continue;
      const list = bySection.get(section)!;
      // find next not-yet-selected in this section
      let next: string | undefined;
      let cursor = taken;
      while (cursor < list.length) {
        if (!selectedSet.has(list[cursor]!)) {
          next = list[cursor];
          break;
        }
        cursor += 1;
      }
      perSectionTaken.set(section, cursor + 1);
      if (next && !selectedSet.has(next)) {
        selected.push(next);
        selectedSet.add(next);
        progress = true;
      }
    }
  }

  // Record a small sample of what we deliberately skipped (transparency for the report).
  const skipped: string[] = [];
  for (const list of bySection.values()) {
    for (const u of list) {
      if (!selectedSet.has(u) && skipped.length < 20) skipped.push(u);
    }
  }

  return { selected, sections, skippedSample: skipped };
}

/** End to end: discover candidate URLs and select the representative set to check. */
export async function discoverPages(
  homepageFinalUrl: string,
  homepageHtml: string,
  sitemapUrls: string[],
  sitemapSource: "sitemap" | "sitemap-index" | null,
  opts: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const maxPerSection = opts.maxPerSection ?? DEFAULT_MAX_PER_SECTION;
  const origin = new URL(homepageFinalUrl).origin;

  let candidates: string[];
  let source: DiscoveryResult["source"];

  if (sitemapUrls.length > 0 && sitemapSource) {
    candidates = sitemapUrls;
    source = sitemapSource;
  } else {
    const links = urlsFromHomepageLinks(homepageHtml, origin);
    if (links.length > 0) {
      candidates = links;
      source = "homepage-links";
    } else {
      candidates = [homepageFinalUrl];
      source = "single";
    }
  }

  const { selected, sections, skippedSample } = selectRepresentative(
    homepageFinalUrl,
    candidates,
    { maxPages, maxPerSection },
  );

  return {
    selected,
    source,
    totalDiscovered: new Set(candidates).size,
    sections,
    skippedSample,
  };
}
