// Static (no headless browser) fetch layer + block detector + domain files.

export const DEFAULT_UA =
  "Mozilla/5.0 (compatible; GeoRepairBot/0.1; +https://geo.repair/bot)";
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_BYTES = 4 * 1024 * 1024;

export const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "CCBot",
];

export interface RawFetch {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  contentType: string;
  headers: Record<string, string>;
  body: string;
  byteLength: number;
  error?: string;
}

export interface RobotsInfo {
  fetched: boolean;
  status: number;
  content: string;
  sitemaps: string[];
  blocksGooglebot: boolean;
  aiCrawlerRules: { agent: string; blocked: boolean }[];
}

export interface SitemapInfo {
  fetched: boolean;
  status: number;
  ok: boolean;
  isXml: boolean;
  isIndex: boolean;
  urlCount: number;
  // Count of <loc> entries ending in .md (markdown twins listed in the
  // sitemap). null when the sitemap is an index (locs are child sitemaps,
  // so .md inclusion is unknown without crawling them).
  mdUrlCount: number | null;
  referencedInRobots: boolean;
  urls: string[];
}

export interface LlmsTxtInfo {
  fetched: boolean;
  status: number;
  ok: boolean;
  nonEmpty: boolean;
  hasLinks: boolean;
}

export interface DomainFiles {
  origin: string;
  sitemapUrl: string;
  robots: RobotsInfo;
  sitemap: SitemapInfo;
  llmsTxt: LlmsTxtInfo;
}

function headersToObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text().catch(() => "");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  try {
    await reader.cancel();
  } catch {
    /* ignore */
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export interface RawFetchOptions {
  timeoutMs?: number;
  // Override request headers (e.g. a custom User-Agent or Accept) for the
  // markdown content-negotiation probes.
  headers?: Record<string, string>;
}

// Static GET. Never throws: failures come back on the `error` field.
export async function rawFetch(url: string, opts: RawFetchOptions = {}): Promise<RawFetch> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...opts.headers,
      },
    });
    const body = await readCapped(res, MAX_BYTES);
    return {
      requestedUrl: url,
      finalUrl: res.url || url,
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get("content-type") ?? "",
      headers: headersToObject(res.headers),
      body,
      byteLength: body.length,
    };
  } catch (err) {
    return {
      requestedUrl: url,
      finalUrl: url,
      status: 0,
      ok: false,
      contentType: "",
      headers: {},
      body: "",
      byteLength: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

const BLOCK_MARKERS = [
  "just a moment",
  "attention required",
  "enable javascript",
  "captcha",
  "access denied",
  "verify you are human",
];

export function detectBlock(res: RawFetch): string | null {
  if (res.error) return `fetch error: ${res.error}`;
  if (res.status === 403 || res.status === 429 || res.status === 503) {
    return `HTTP ${res.status}`;
  }
  const lower = res.body.slice(0, 4000).toLowerCase();
  for (const marker of BLOCK_MARKERS) {
    if (lower.includes(marker)) return `challenge marker: "${marker}"`;
  }
  return null;
}

function originOf(finalUrl: string): string {
  try {
    return new URL(finalUrl).origin;
  } catch {
    return finalUrl;
  }
}

function parseRobots(content: string, origin: string) {
  const lines = content.split(/\r?\n/);
  const sitemaps: string[] = [];
  const groups: { agents: string[]; disallows: string[] }[] = [];
  let current: { agents: string[]; disallows: string[] } | null = null;
  let lastWasAgent = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallows: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === "disallow") {
      if (current) current.disallows.push(value);
      lastWasAgent = false;
    } else if (field === "sitemap") {
      try {
        sitemaps.push(new URL(value, origin).toString());
      } catch {
        /* ignore */
      }
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }

  const rootBlocked = (agent: string): boolean => {
    const a = agent.toLowerCase();
    let blocked = false;
    for (const g of groups) {
      const matches = g.agents.includes(a) || g.agents.includes("*");
      if (!matches) continue;
      const specific = g.agents.includes(a);
      const blocksRoot = g.disallows.some((d) => d === "/");
      if (specific) return blocksRoot;
      blocked = blocked || blocksRoot;
    }
    return blocked;
  };

  return {
    content,
    sitemaps,
    blocksGooglebot: rootBlocked("googlebot"),
    aiCrawlerRules: AI_CRAWLERS.map((agent) => ({ agent, blocked: rootBlocked(agent) })),
  };
}

export async function fetchDomainFiles(finalUrl: string): Promise<DomainFiles> {
  const origin = originOf(finalUrl);
  const [robotsRes, llmsRes] = await Promise.all([
    rawFetch(`${origin}/robots.txt`),
    rawFetch(`${origin}/llms.txt`),
  ]);

  const robots: RobotsInfo =
    robotsRes.ok && robotsRes.body.trim()
      ? { fetched: true, status: robotsRes.status, ...parseRobots(robotsRes.body, origin) }
      : {
          fetched: false,
          status: robotsRes.status,
          content: "",
          sitemaps: [],
          blocksGooglebot: false,
          aiCrawlerRules: AI_CRAWLERS.map((agent) => ({ agent, blocked: false })),
        };

  const sitemapUrl = robots.sitemaps[0] ?? `${origin}/sitemap.xml`;
  const sitemapRes = await rawFetch(sitemapUrl);
  const isXml =
    sitemapRes.contentType.includes("xml") ||
    sitemapRes.body.trimStart().startsWith("<?xml") ||
    sitemapRes.body.includes("<urlset") ||
    sitemapRes.body.includes("<sitemapindex");
  const isIndex = isXml && /<sitemapindex[\s>]/i.test(sitemapRes.body);
  const locs = isXml
    ? (sitemapRes.body.match(/<loc>\s*([^<\s]+)\s*<\/loc>/gi) ?? []).map((s) =>
        s.replace(/<\/?loc>/gi, "").trim().replace(/&amp;/g, "&"),
      )
    : [];
  const sitemap: SitemapInfo = {
    fetched: sitemapRes.status !== 0,
    status: sitemapRes.status,
    ok: sitemapRes.ok && isXml,
    isXml,
    isIndex,
    urlCount: locs.length,
    mdUrlCount: isIndex ? null : locs.filter((l) => /\.md(\?|#|$)/i.test(l)).length,
    referencedInRobots: robots.sitemaps.length > 0,
    urls: isIndex ? [] : locs,
  };

  const llmsTxt: LlmsTxtInfo = {
    fetched: llmsRes.status !== 0,
    status: llmsRes.status,
    ok: llmsRes.ok,
    nonEmpty: llmsRes.ok && llmsRes.body.trim().length > 0,
    hasLinks: llmsRes.ok && /\]\(https?:\/\//.test(llmsRes.body),
  };

  return { origin, sitemapUrl, robots, sitemap, llmsTxt };
}

// --- Markdown-twin / AEO delivery probe -------------------------------------
// dualmark-style conformance: does the site serve a clean Markdown "twin" of
// the page over HTTP content negotiation, with the right headers? These are the
// signals AI crawlers use (they want markdown, not a JS-heavy DOM). We probe by
// fetching <path>.md and re-requesting the HTML URL as an AI client would.

// A representative AI crawler UA (matches the AI Agent Registry).
const AI_BOT_UA =
  "Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)";

export interface TwinProbe {
  twinUrl: string;
  // The <path>.md fetch.
  twin: {
    fetched: boolean;
    status: number;
    ok: boolean;
    contentType: string;
    isMarkdownType: boolean;
    charsetUtf8: boolean; // Content-Type declares charset=utf-8 (spec MUST)
    nonEmpty: boolean;
    // Delivery headers on the markdown response.
    noindex: boolean; // X-Robots-Tag contains "noindex"
    varyAccept: boolean; // Vary contains "Accept"
    tokensHeader: boolean; // X-Markdown-Tokens is a positive integer
    nosniff: boolean; // X-Content-Type-Options: nosniff (spec SHOULD)
    aeoVersion: boolean; // X-AEO-Version present and non-empty (spec SHOULD)
  };
  // Re-requesting the HTML URL with Accept: text/markdown.
  acceptServesMarkdown: boolean;
  // Re-requesting the HTML URL with an AI-bot User-Agent.
  botUaServesMarkdown: boolean;
  // The HTML response's own Link header advertised a markdown alternate.
  htmlLinkAlternate: boolean;
  // The HTML response itself sends Vary: Accept (the negotiated URL must vary
  // on Accept in BOTH representations, not just the twin).
  htmlVaryAccept: boolean;
  // Spec SHOULD: an Accept header matching neither HTML nor markdown (nor a
  // wildcard) gets 406 Not Acceptable. Informational only — never scored.
  notAcceptable: { probed: boolean; status: number; returns406: boolean };
}

// Derive the conventional twin URL for a page: <path>.md (root -> /index.md).
export function twinUrlFor(pageUrl: string): string {
  try {
    const u = new URL(pageUrl);
    u.hash = "";
    u.search = "";
    let path = u.pathname.replace(/\/+$/, "");
    if (path === "" || path === "/") path = "/index";
    if (/\.[a-z0-9]+$/i.test(path)) path = path.replace(/\.[a-z0-9]+$/i, "");
    u.pathname = `${path}.md`;
    return u.toString();
  } catch {
    return `${pageUrl.replace(/\/+$/, "")}.md`;
  }
}

function isMarkdownContentType(ct: string): boolean {
  return /text\/markdown|text\/x-markdown/i.test(ct);
}

// True when a negotiation response (re-requested HTML URL) actually returned
// markdown rather than HTML.
function servedMarkdown(res: RawFetch): boolean {
  if (!res.ok) return false;
  if (isMarkdownContentType(res.contentType)) return true;
  // Some servers mislabel; fall back to a content sniff: markdown bodies don't
  // open with an HTML document and don't carry a doctype/<html>.
  const head = res.body.slice(0, 600).toLowerCase();
  const looksHtml = /<!doctype html|<html|<head|<body/.test(head);
  return !looksHtml && !res.contentType.includes("text/html") && res.body.trim().length > 0;
}

// Probe a single page for Markdown-twin / content-negotiation conformance.
// `htmlHeaders` are the already-fetched HTML response headers (for the Link
// alternate check), so we don't re-fetch the page itself.
export async function probeTwin(
  pageUrl: string,
  htmlHeaders: Record<string, string>,
): Promise<TwinProbe> {
  const twinUrl = twinUrlFor(pageUrl);

  const [twinRes, acceptRes, botRes, unacceptableRes] = await Promise.all([
    rawFetch(twinUrl),
    rawFetch(pageUrl, { headers: { Accept: "text/markdown" } }),
    rawFetch(pageUrl, { headers: { "User-Agent": AI_BOT_UA, Accept: "text/markdown" } }),
    // Neither text/html nor text/markdown nor a wildcard: spec says SHOULD 406.
    rawFetch(pageUrl, { headers: { Accept: "text/n3" } }),
  ]);

  const xRobots = (twinRes.headers["x-robots-tag"] ?? "").toLowerCase();
  const vary = (twinRes.headers["vary"] ?? "").toLowerCase();
  const tokens = twinRes.headers["x-markdown-tokens"] ?? "";
  const ctOptions = (twinRes.headers["x-content-type-options"] ?? "").toLowerCase();
  const aeoVersion = (twinRes.headers["x-aeo-version"] ?? "").trim();
  const linkHeader = (htmlHeaders["link"] ?? "").toLowerCase();
  const htmlVary = (htmlHeaders["vary"] ?? "").toLowerCase();

  return {
    twinUrl,
    twin: {
      fetched: twinRes.status !== 0,
      status: twinRes.status,
      ok: twinRes.ok,
      contentType: twinRes.contentType,
      isMarkdownType: isMarkdownContentType(twinRes.contentType),
      charsetUtf8: /charset\s*=\s*["']?utf-?8/i.test(twinRes.contentType),
      nonEmpty: twinRes.ok && twinRes.body.trim().length > 0,
      noindex: xRobots.includes("noindex"),
      varyAccept: /\baccept\b/.test(vary),
      tokensHeader: /^\d+$/.test(tokens.trim()) && Number(tokens) > 0,
      nosniff: ctOptions.includes("nosniff"),
      aeoVersion: aeoVersion.length > 0,
    },
    acceptServesMarkdown: servedMarkdown(acceptRes),
    botUaServesMarkdown: servedMarkdown(botRes),
    htmlLinkAlternate:
      linkHeader.includes('rel="alternate"') && linkHeader.includes("text/markdown"),
    htmlVaryAccept: /\baccept\b/.test(htmlVary),
    notAcceptable: {
      probed: unacceptableRes.status !== 0,
      status: unacceptableRes.status,
      returns406: unacceptableRes.status === 406,
    },
  };
}
