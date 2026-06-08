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

// Static GET. Never throws: failures come back on the `error` field.
export async function rawFetch(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<RawFetch> {
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
