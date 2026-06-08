import { rawFetch } from "./fetcher";

export interface DiscoveryResult {
  selected: string[];
  source: "sitemap" | "sitemap-index" | "homepage-links" | "single";
  totalDiscovered: number;
  sections: Record<string, number>;
}

const SITEMAP_URL_CAP = 5000;
const SITEMAP_INDEX_CHILD_CAP = 20;

const PRIORITY_SLUGS = [
  "pricing", "price", "plans", "features", "product", "products", "solutions",
  "platform", "about", "about-us", "contact", "services", "use-cases", "how-it-works",
  "blog", "docs", "guides", "resources",
];

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

function priorityRank(url: string): number {
  try {
    const seg = new URL(url).pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
    const idx = PRIORITY_SLUGS.indexOf(seg);
    return idx === -1 ? PRIORITY_SLUGS.length : idx;
  } catch {
    return PRIORITY_SLUGS.length;
  }
}

function normalize(url: string): string | null {
  try {
    const u = new URL(url);
    u.hash = "";
    if (/\.(xml|json|txt|pdf|jpe?g|png|gif|svg|webp|ico|css|js|mp4|zip|rss)$/i.test(u.pathname)) return null;
    if (u.pathname !== "/" && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString();
  } catch {
    return null;
  }
}

async function urlsFromSitemap(origin: string, sitemapUrl: string) {
  const res = await rawFetch(sitemapUrl);
  if (!res.ok || !res.body) return null;
  const looksXml = res.body.includes("<urlset") || res.body.includes("<sitemapindex") || res.body.trimStart().startsWith("<?xml");
  if (!looksXml) return null;
  const sameOrigin = (u: string) => {
    try {
      return new URL(u).origin === origin;
    } catch {
      return false;
    }
  };
  if (/<sitemapindex[\s>]/i.test(res.body)) {
    const children = extractLocs(res.body, SITEMAP_INDEX_CHILD_CAP);
    const all: string[] = [];
    for (const child of children) {
      if (all.length >= SITEMAP_URL_CAP) break;
      const cr = await rawFetch(child);
      if (cr.ok && cr.body) all.push(...extractLocs(cr.body, SITEMAP_URL_CAP - all.length));
    }
    const urls = [...new Set(all)].filter(sameOrigin);
    return urls.length ? { urls, source: "sitemap-index" as const } : null;
  }
  const urls = [...new Set(extractLocs(res.body, SITEMAP_URL_CAP))].filter(sameOrigin);
  return urls.length ? { urls, source: "sitemap" as const } : null;
}

function urlsFromHomepageLinks(html: string, origin: string): string[] {
  const out = new Set<string>();
  const re = /<a\b[^>]*\bhref=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (!href || /^(mailto:|tel:|javascript:|data:)/i.test(href)) continue;
    try {
      const u = new URL(href, origin);
      u.hash = "";
      if (u.origin === origin && (u.protocol === "https:" || u.protocol === "http:")) out.add(u.toString());
    } catch {
      /* ignore */
    }
  }
  return [...out];
}

function selectRepresentative(
  homepage: string,
  candidates: string[],
  opts: { maxPages: number; maxPerSection: number },
) {
  const homeUrl = normalize(homepage) ?? homepage;
  const seen = new Set<string>();
  const bySection = new Map<string, string[]>();
  const sections: Record<string, number> = {};
  const topLevel: string[] = [];

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
    const sec = sectionOf(pathname);
    sections[sec] = (sections[sec] ?? 0) + 1;
    if (!bySection.has(sec)) bySection.set(sec, []);
    bySection.get(sec)!.push(url);
    if (depthOf(url) <= 1) topLevel.push(url);
  }

  for (const list of bySection.values()) {
    list.sort((a, b) => depthOf(a) - depthOf(b) || a.length - b.length);
  }

  const selected: string[] = [homeUrl];
  const selectedSet = new Set<string>([homeUrl]);

  topLevel.sort((a, b) => priorityRank(a) - priorityRank(b) || a.localeCompare(b));
  for (const u of topLevel) {
    if (selected.length >= opts.maxPages) break;
    if (!selectedSet.has(u)) {
      selected.push(u);
      selectedSet.add(u);
    }
  }

  const deepSections = [...bySection.keys()]
    .filter((s) => s !== "/")
    .sort((a, b) => bySection.get(b)!.length - bySection.get(a)!.length || a.localeCompare(b));
  const taken = new Map<string, number>();
  let progress = true;
  while (selected.length < opts.maxPages && progress) {
    progress = false;
    for (const sec of deepSections) {
      if (selected.length >= opts.maxPages) break;
      const t = taken.get(sec) ?? 0;
      if (t >= opts.maxPerSection) continue;
      const list = bySection.get(sec)!;
      let next: string | undefined;
      let cursor = t;
      while (cursor < list.length) {
        if (!selectedSet.has(list[cursor]!)) {
          next = list[cursor];
          break;
        }
        cursor += 1;
      }
      taken.set(sec, cursor + 1);
      if (next && !selectedSet.has(next)) {
        selected.push(next);
        selectedSet.add(next);
        progress = true;
      }
    }
  }

  return { selected, sections };
}

export async function discoverPages(
  homepageFinalUrl: string,
  homepageHtml: string,
  opts: { maxPages: number; maxPerSection: number },
): Promise<DiscoveryResult> {
  const origin = new URL(homepageFinalUrl).origin;

  const fromSitemap = await urlsFromSitemap(origin, `${origin}/sitemap.xml`);
  let candidates: string[];
  let source: DiscoveryResult["source"];

  if (fromSitemap && fromSitemap.urls.length) {
    candidates = fromSitemap.urls;
    source = fromSitemap.source;
  } else {
    const links = urlsFromHomepageLinks(homepageHtml, origin);
    if (links.length) {
      candidates = links;
      source = "homepage-links";
    } else {
      candidates = [homepageFinalUrl];
      source = "single";
    }
  }

  const { selected, sections } = selectRepresentative(homepageFinalUrl, candidates, opts);
  return { selected, source, totalDiscovered: new Set(candidates).size, sections };
}
