// HTML -> PageModel parser. Uses Bun's built-in HTMLRewriter (no external deps).
// Extracts every signal the deterministic checks in /scraper.md section 2 need.

import type { RawFetch } from "./fetcher.ts";
import type {
  Anchor,
  Heading,
  ImageTag,
  Interactive,
  JsonLdBlock,
  LinkTag,
  MetaTag,
  PageModel,
} from "./types.ts";

// Inline elements whose text should not introduce whitespace gaps.
const SKIP_TEXT_TAGS = new Set(["script", "style", "noscript", "template", "svg"]);

function parseJsonLd(raw: string): JsonLdBlock {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { raw: "", valid: false, types: [], error: "empty block" };
  }
  try {
    const parsed = JSON.parse(trimmed);
    const types = new Set<string>();
    const collect = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(collect);
        return;
      }
      if (node && typeof node === "object") {
        const obj = node as Record<string, unknown>;
        const t = obj["@type"];
        if (typeof t === "string") types.add(t);
        else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));
        if (Array.isArray(obj["@graph"])) collect(obj["@graph"]);
      }
    };
    collect(parsed);
    return { raw: trimmed, valid: true, types: [...types] };
  } catch (err) {
    return {
      raw: trimmed,
      valid: false,
      types: [],
      error: err instanceof Error ? err.message : "invalid JSON",
    };
  }
}

function accessibleNameFromAttrs(
  attrs: Map<string, string>,
  text: string,
  labelFor: Set<string>,
): string | null {
  const ariaLabel = attrs.get("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;
  if (attrs.get("aria-labelledby")?.trim()) return "(aria-labelledby)";
  const title = attrs.get("title")?.trim();
  const value = attrs.get("value")?.trim();
  const alt = attrs.get("alt")?.trim();
  const placeholder = attrs.get("placeholder")?.trim();
  const id = attrs.get("id")?.trim();
  if (text.trim()) return text.trim();
  if (value) return value;
  if (alt) return alt;
  if (id && labelFor.has(id)) return "(label[for])";
  if (title) return title;
  if (placeholder) return placeholder; // weak, but a name source
  return null;
}

/**
 * Build the PageModel from a raw static fetch.
 * Two-pass: HTMLRewriter streams elements; a light text accumulator builds visible text.
 */
export async function parsePage(raw: RawFetch): Promise<PageModel> {
  const html = raw.body;

  const metas: MetaTag[] = [];
  const links: LinkTag[] = [];
  const headings: Heading[] = [];
  const anchors: Anchor[] = [];
  const images: ImageTag[] = [];
  const interactives: Interactive[] = [];
  const jsonLd: JsonLdBlock[] = [];
  const labelFor = new Set<string>();
  const landmarks = { header: false, nav: false, main: false, footer: false };

  let title: string | null = null;
  let htmlLang: string | null = null;
  let hasDoctype = /^\s*<!doctype\s+html/i.test(html);
  let scriptCount = 0;
  let noscriptText = "";

  // Capture state for elements whose text content we need.
  let titleBuf: string | null = null;
  let jsonLdBuf: string | null = null;
  let noscriptBuf: string | null = null;

  // Current heading/anchor capture.
  type Capture = { kind: "heading"; level: number; text: string } | {
    kind: "anchor";
    attrs: Map<string, string>;
    text: string;
    hasImg: boolean;
    imgAlt?: string;
  } | { kind: "interactive"; tag: Interactive["tag"]; attrs: Map<string, string>; text: string };
  let capture: Capture | null = null;

  const visibleParts: string[] = [];

  const getAttrs = (el: { getAttribute: (n: string) => string | null }, names: string[]): Map<string, string> => {
    const m = new Map<string, string>();
    for (const n of names) {
      const v = el.getAttribute(n);
      if (v !== null) m.set(n, v);
    }
    return m;
  };

  const rewriter = new HTMLRewriter()
    .on("html", {
      element(el) {
        htmlLang = el.getAttribute("lang");
      },
    })
    .on("meta", {
      element(el) {
        metas.push({
          name: el.getAttribute("name") ?? undefined,
          property: el.getAttribute("property") ?? undefined,
          httpEquiv: el.getAttribute("http-equiv") ?? undefined,
          content: el.getAttribute("content") ?? undefined,
          charset: el.getAttribute("charset") ?? undefined,
        });
      },
    })
    .on("link", {
      element(el) {
        links.push({
          rel: el.getAttribute("rel") ?? undefined,
          href: el.getAttribute("href") ?? undefined,
          type: el.getAttribute("type") ?? undefined,
          hreflang: el.getAttribute("hreflang") ?? undefined,
          sizes: el.getAttribute("sizes") ?? undefined,
        });
      },
    })
    .on("title", {
      element() {
        titleBuf = "";
      },
      text(t) {
        if (titleBuf !== null) titleBuf += t.text;
        if (t.lastInTextNode && titleBuf !== null) {
          title = titleBuf.trim();
          titleBuf = null;
        }
      },
    })
    .on('script[type="application/ld+json"]', {
      element() {
        jsonLdBuf = "";
      },
      text(t) {
        if (jsonLdBuf !== null) jsonLdBuf += t.text;
        if (t.lastInTextNode && jsonLdBuf !== null) {
          jsonLd.push(parseJsonLd(jsonLdBuf));
          jsonLdBuf = null;
        }
      },
    })
    .on("script", {
      element() {
        scriptCount += 1;
      },
    })
    .on("noscript", {
      element() {
        noscriptBuf = "";
      },
      text(t) {
        if (noscriptBuf !== null) noscriptBuf += t.text;
        if (t.lastInTextNode && noscriptBuf !== null) {
          noscriptText += " " + noscriptBuf;
          noscriptBuf = null;
        }
      },
    })
    .on("header", { element() { landmarks.header = true; } })
    .on("nav", { element() { landmarks.nav = true; } })
    .on("main", { element() { landmarks.main = true; } })
    .on("footer", { element() { landmarks.footer = true; } })
    .on("label", {
      element(el) {
        const f = el.getAttribute("for");
        if (f) labelFor.add(f);
      },
    })
    .on("img", {
      element(el) {
        const alt = el.getAttribute("alt");
        images.push({
          src: el.getAttribute("src") ?? undefined,
          alt: alt, // null = attribute absent, "" = decorative
          role: el.getAttribute("role") ?? undefined,
          ariaHidden: el.getAttribute("aria-hidden") === "true",
        });
        if (capture?.kind === "anchor") {
          capture.hasImg = true;
          if (alt) capture.imgAlt = alt;
        }
      },
    });

  // Headings.
  for (let level = 1; level <= 6; level++) {
    rewriter.on(`h${level}`, {
      element(el) {
        capture = { kind: "heading", level, text: "" };
        el.onEndTag(() => {
          if (capture?.kind === "heading") {
            headings.push({ level: capture.level, text: capture.text.trim() });
            capture = null;
          }
        });
      },
      text(t) {
        if (capture?.kind === "heading") capture.text += t.text;
      },
    });
  }

  // Anchors.
  rewriter.on("a", {
    element(el) {
      const attrs = getAttrs(el, ["href", "rel", "aria-label", "title"]);
      capture = { kind: "anchor", attrs, text: "", hasImg: false };
      el.onEndTag(() => {
        if (capture?.kind === "anchor") {
          const a = capture;
          anchors.push({
            href: a.attrs.get("href") ?? "",
            text: a.text.trim(),
            rel: a.attrs.get("rel"),
            ariaLabel: a.attrs.get("aria-label"),
            title: a.attrs.get("title"),
            hasImg: a.hasImg,
            imgAlt: a.imgAlt,
          });
          capture = null;
        }
      });
    },
    text(t) {
      if (capture?.kind === "anchor") capture.text += t.text;
    },
  });

  // Interactive controls. `input` is a void element (no end tag) so it is handled inline;
  // button/select/textarea have end tags and capture their text content.
  rewriter.on("input", {
    element(el) {
      const attrs = getAttrs(el, [
        "type", "aria-label", "aria-labelledby", "aria-hidden", "title",
        "value", "alt", "placeholder", "id", "role", "disabled",
      ]);
      interactives.push({
        tag: "input",
        type: attrs.get("type"),
        accessibleName: accessibleNameFromAttrs(attrs, "", labelFor),
        role: attrs.get("role"),
        ariaHidden: attrs.get("aria-hidden") === "true",
        disabled: attrs.has("disabled"),
      });
    },
  });

  const interactiveTags: Exclude<Interactive["tag"], "input">[] = ["button", "select", "textarea"];
  for (const tag of interactiveTags) {
    rewriter.on(tag, {
      element(el) {
        const attrs = getAttrs(el, [
          "type",
          "aria-label",
          "aria-labelledby",
          "aria-hidden",
          "title",
          "value",
          "alt",
          "placeholder",
          "id",
          "role",
          "disabled",
        ]);
        const self = { kind: "interactive" as const, tag, attrs, text: "" };
        capture = self;
        el.onEndTag(() => {
          const name = accessibleNameFromAttrs(self.attrs, self.text, labelFor);
          interactives.push({
            tag,
            type: self.attrs.get("type"),
            accessibleName: name,
            role: self.attrs.get("role"),
            ariaHidden: self.attrs.get("aria-hidden") === "true",
            disabled: self.attrs.has("disabled"),
          });
          if (capture === self) capture = null;
        });
      },
      text(t) {
        if (capture?.kind === "interactive" && capture.tag === tag) capture.text += t.text;
      },
    });
  }

  // Visible text accumulation from body, skipping script/style/etc.
  rewriter.on("body *", {
    text(t) {
      if (t.text.trim()) visibleParts.push(t.text);
    },
  });
  // Fallback: some documents put text directly under nodes without body wrapper handling.
  rewriter.on("p, li, td, th, dd, dt, blockquote, figcaption, span, div", {
    text() {
      /* covered by body * but keeps selector warm */
    },
  });

  const response = new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  await rewriter.transform(response).text();

  // Derive metaByKey + canonical/robots.
  const metaByKey = new Map<string, string>();
  let charsetValue: string | null = null;
  let metaRobots: string | null = null;
  for (const m of metas) {
    if (m.charset) charsetValue = m.charset;
    if (m.httpEquiv?.toLowerCase() === "content-type" && m.content) {
      const cm = m.content.match(/charset=([\w-]+)/i);
      if (cm?.[1]) charsetValue = cm[1];
    }
    const key = (m.name ?? m.property)?.toLowerCase();
    if (key && m.content !== undefined) {
      if (!metaByKey.has(key)) metaByKey.set(key, m.content);
      if (key === "robots") metaRobots = m.content;
    }
  }

  // charset declared early (first ~1024 bytes).
  const head1024 = html.slice(0, 1024).toLowerCase();
  const charsetEarly =
    /<meta\s+charset=/i.test(head1024) ||
    /charset=/.test(head1024.match(/<meta[^>]+content-type[^>]*>/)?.[0] ?? "");

  let canonical: string | null = null;
  for (const l of links) {
    if (l.rel?.toLowerCase().split(/\s+/).includes("canonical") && l.href) {
      canonical = l.href;
      break;
    }
  }

  const viewport = metaByKey.get("viewport") ?? null;
  const viewportResponsive = viewport !== null && /width\s*=\s*device-width/i.test(viewport);

  const visibleText = visibleParts.join(" ").replace(/\s+/g, " ").trim();
  const wordCount = visibleText ? visibleText.split(/\s+/).length : 0;

  // SPA root detection: near-empty body text but a known mount node / heavy script.
  const bodyTextLen = visibleText.length;
  const spaRootDetected =
    bodyTextLen < 200 &&
    (/<div[^>]+id=["'](root|app|__next|___gatsby)["']/i.test(html) || scriptCount >= 1);

  return {
    requestedUrl: raw.requestedUrl,
    finalUrl: raw.finalUrl,
    status: raw.status,
    ok: raw.ok,
    contentType: raw.contentType,
    headers: raw.headers,
    rawHtml: html,
    htmlByteLength: raw.byteLength,
    hasDoctype,
    charsetEarly,
    charsetValue,
    htmlLang,
    viewport,
    viewportResponsive,
    title,
    metas,
    links,
    canonical,
    metaRobots,
    xRobotsTag: raw.headers["x-robots-tag"] ?? null,
    jsonLd,
    headings,
    anchors,
    images,
    interactives,
    landmarks,
    labelFor,
    visibleText,
    wordCount,
    scriptCount,
    spaRootDetected,
    noscriptText: noscriptText.trim(),
    metaByKey,
  };
}
