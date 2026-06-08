import type { RawFetch } from "./fetcher";

export interface MetaTag {
  name?: string;
  property?: string;
  httpEquiv?: string;
  content?: string;
  charset?: string;
}

export interface LinkTag {
  rel?: string;
  href?: string;
  type?: string;
  hreflang?: string;
  sizes?: string;
}

export interface JsonLdBlock {
  valid: boolean;
  types: string[];
}

export interface PageModel {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  rawHtml: string;
  byteLength: number;

  hasDoctype: boolean;
  charsetEarly: boolean;
  charsetValue: string | null;
  htmlLang: string | null;
  viewport: string | null;
  viewportResponsive: boolean;

  title: string | null;
  metas: MetaTag[];
  links: LinkTag[];
  canonical: string | null;
  metaRobots: string | null;
  xRobotsTag: string | null;

  jsonLd: JsonLdBlock[];
  h1Count: number;
  headingLevels: number[];
  headings: { level: number; text: string }[];
  landmarks: { header: boolean; nav: boolean; main: boolean; footer: boolean };

  images: { hasAlt: boolean; emptyAlt: boolean; decorative: boolean }[];
  anchors: { href: string; text: string }[];
  interactives: { tag: string; hasName: boolean }[];

  visibleText: string;
  wordCount: number;
  scriptCount: number;
  spaRootDetected: boolean;

  metaByKey: Map<string, string>;
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function parsePage(raw: RawFetch): PageModel {
  const html = raw.body;
  const head = html.slice(0, 200_000);

  const metaTags = head.match(/<meta\b[^>]*>/gi) ?? [];
  const metas: MetaTag[] = metaTags.map((t) => ({
    name: attr(t, "name")?.toLowerCase(),
    property: attr(t, "property")?.toLowerCase(),
    httpEquiv: attr(t, "http-equiv")?.toLowerCase(),
    content: attr(t, "content"),
    charset: attr(t, "charset"),
  }));

  const metaByKey = new Map<string, string>();
  for (const m of metas) {
    const key = m.property ?? m.name;
    if (key && m.content) metaByKey.set(key, m.content);
  }

  const linkTags = head.match(/<link\b[^>]*>/gi) ?? [];
  const links: LinkTag[] = linkTags.map((t) => ({
    rel: attr(t, "rel")?.toLowerCase(),
    href: attr(t, "href"),
    type: attr(t, "type")?.toLowerCase(),
    hreflang: attr(t, "hreflang"),
    sizes: attr(t, "sizes"),
  }));

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]!.trim()) : null;

  const canonical = links.find((l) => l.rel === "canonical")?.href ?? null;
  const metaRobots = metaByKey.get("robots") ?? null;
  const xRobotsTag = raw.headers["x-robots-tag"] ?? null;

  // charset within first ~1024 bytes
  const first1k = html.slice(0, 1024);
  const charsetMeta = metas.find((m) => m.charset)?.charset ?? null;
  const charsetEarly = /<meta\b[^>]*charset/i.test(first1k);

  const viewport = metaByKey.get("viewport") ?? null;
  const viewportResponsive = !!viewport && /width\s*=\s*device-width/i.test(viewport);

  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";
  const htmlLang = attr(htmlTag, "lang") ?? null;

  // JSON-LD
  const ldBlocks = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const jsonLd: JsonLdBlock[] = ldBlocks.map((block) => {
    const inner = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const parsed = JSON.parse(inner);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const types = items.flatMap((it) => {
        const t = it?.["@type"];
        return Array.isArray(t) ? t : t ? [t] : [];
      });
      return { valid: true, types };
    } catch {
      return { valid: false, types: [] };
    }
  });

  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  const headingLevels = (html.match(/<h([1-6])\b/gi) ?? []).map((h) =>
    parseInt(h.replace(/[^1-6]/g, ""), 10),
  );

  const headingTags = html.match(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi) ?? [];
  const headings = headingTags.map((t) => {
    const level = parseInt(t.match(/<h([1-6])/i)?.[1] ?? "0", 10);
    const text = decodeEntities(t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    return { level, text };
  });

  const landmarks = {
    header: /<header\b/i.test(html),
    nav: /<nav\b/i.test(html),
    main: /<main\b/i.test(html) || /role=["']main["']/i.test(html),
    footer: /<footer\b/i.test(html),
  };

  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const images = imgTags.map((t) => {
    const alt = attr(t, "alt");
    const role = attr(t, "role")?.toLowerCase();
    const ariaHidden = /aria-hidden\s*=\s*["']?true/i.test(t);
    return {
      hasAlt: alt !== undefined,
      emptyAlt: alt === "",
      decorative: alt === "" || role === "presentation" || role === "none" || ariaHidden,
    };
  });

  const anchorTags = html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/gi) ?? [];
  const anchors = anchorTags.map((t) => {
    const open = t.match(/<a\b[^>]*>/i)?.[0] ?? "";
    const href = attr(open, "href") ?? "";
    const text = decodeEntities(t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    return { href, text };
  });

  const buttonTags = html.match(/<button\b[^>]*>([\s\S]*?)<\/button>/gi) ?? [];
  const interactives = buttonTags.map((t) => {
    const open = t.match(/<button\b[^>]*>/i)?.[0] ?? "";
    const ariaLabel = attr(open, "aria-label");
    const text = t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { tag: "button", hasName: !!(ariaLabel || text) };
  });

  // Visible text (strip script/style/tags). Rough but enough for word counts.
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const visibleText = decodeEntities(stripped).replace(/\s+/g, " ").trim();
  const wordCount = visibleText ? visibleText.split(/\s+/).length : 0;

  const scriptCount = (html.match(/<script\b/gi) ?? []).length;
  const spaRootDetected =
    /<div\s+id=["'](root|app|__next)["']/i.test(html) && wordCount < 120;

  return {
    requestedUrl: raw.requestedUrl,
    finalUrl: raw.finalUrl,
    status: raw.status,
    ok: raw.ok,
    headers: raw.headers,
    rawHtml: html,
    byteLength: raw.byteLength,
    hasDoctype: /^\s*<!doctype html>/i.test(html),
    charsetEarly,
    charsetValue: charsetMeta,
    htmlLang,
    viewport,
    viewportResponsive,
    title,
    metas,
    links,
    canonical,
    metaRobots,
    xRobotsTag,
    jsonLd,
    h1Count,
    headingLevels,
    headings,
    landmarks,
    images,
    anchors,
    interactives,
    visibleText,
    wordCount,
    scriptCount,
    spaRootDetected,
    metaByKey,
  };
}
