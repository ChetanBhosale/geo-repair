// Markdown-twin probe (dualmark AEO spec). Detection recipe per /scraper.md
// "Detecting markdown-twins (prior art: dualmark)". Pure header/status/body inspection.

import { rawFetch, type FetchOptions } from "./fetcher.ts";
import type { PageModel, TwinProbe } from "./types.ts";

/** Derive `<path>.md` for a page URL, stripping query/hash. */
export function toMarkdownUrl(pageUrl: string): string {
  const u = new URL(pageUrl);
  u.search = "";
  u.hash = "";
  let path = u.pathname;
  if (path.endsWith(".md")) return u.toString();
  if (path === "" || path === "/") {
    u.pathname = "/index.md";
  } else {
    path = path.replace(/\/+$/, "");
    u.pathname = `${path}.md`;
  }
  return u.toString();
}

function headerHasToken(value: string | undefined, token: string): boolean {
  if (!value) return false;
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(token.toLowerCase());
}

/** Does the HTML page advertise a markdown twin via Link rel=alternate (header or <link>)? */
function htmlAdvertisesTwin(page: PageModel): boolean {
  const linkHeader = page.headers["link"] ?? "";
  if (
    linkHeader.includes('rel="alternate"') &&
    linkHeader.toLowerCase().includes("text/markdown")
  ) {
    return true;
  }
  return page.links.some(
    (l) =>
      l.rel?.toLowerCase().split(/\s+/).includes("alternate") &&
      (l.type?.toLowerCase() === "text/markdown"),
  );
}

export async function probeTwin(
  page: PageModel,
  options: FetchOptions = {},
): Promise<TwinProbe> {
  const mdUrl = toMarkdownUrl(page.finalUrl);

  const base: TwinProbe = {
    attempted: true,
    mdUrl,
    reachable: false,
    status: 0,
    contentTypeMarkdown: false,
    tokensHeader: false,
    noindex: false,
    varyAccept: false,
    nonEmptyBody: false,
    aeoVersion: false,
    nosniff: false,
    linkAlternate: htmlAdvertisesTwin(page),
    acceptNegotiation: false,
    botUaNegotiation: false,
  };

  // 1) Fetch the twin directly with Accept: text/markdown.
  const md = await rawFetch(mdUrl, { ...options, accept: "text/markdown" });
  base.status = md.status;
  if (md.error) {
    base.error = md.error;
    return base;
  }
  base.reachable = md.ok;
  if (md.ok) {
    const ct = md.contentType.toLowerCase();
    base.contentTypeMarkdown = ct.startsWith("text/markdown");
    base.tokensHeader = /^[1-9]\d*$/.test(md.headers["x-markdown-tokens"] ?? "");
    base.noindex = (md.headers["x-robots-tag"] ?? "").toLowerCase().includes("noindex");
    base.varyAccept = headerHasToken(md.headers["vary"], "accept");
    base.nonEmptyBody = md.body.trim().length > 0;
    base.aeoVersion = /^\d+\.\d+$/.test(md.headers["x-aeo-version"] ?? "");
    base.nosniff = (md.headers["x-content-type-options"] ?? "").toLowerCase() === "nosniff";
  }

  // 2) Content negotiation on the HTML URL: Accept: text/markdown should return markdown.
  const negotiated = await rawFetch(page.finalUrl, { ...options, accept: "text/markdown" });
  if (!negotiated.error) {
    base.acceptNegotiation = negotiated.contentType.toLowerCase().startsWith("text/markdown");
  }

  // 3) Bot-UA negotiation: a GPTBot UA should receive markdown by default.
  const bot = await rawFetch(page.finalUrl, {
    ...options,
    userAgent: "Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)",
    accept: "*/*",
  });
  if (!bot.error) {
    base.botUaNegotiation = bot.contentType.toLowerCase().startsWith("text/markdown");
  }

  return base;
}
