import { RUBRIC_VERSION, check_intent } from "./check-intent";
import type { CheckCategory } from "./check-intent";
import {
  runCheckActivity,
  repoWebsiteMatchActivity,
  ALL_CHECK_NAMES,
  type CheckContext,
} from "./activities";
import { rawFetch, detectBlock, fetchDomainFiles, probeTwin, type DomainFiles } from "./fetcher";
import { parsePage } from "./parser";
import { classifyPage } from "./pagetype";
import { discoverPages } from "./discover";
import { bandFor, scoreChecks } from "./score";
import type {
  CategoryScoreOut,
  CheckResultOut,
  LogEntry,
  PageReport,
  RepoInput,
  ScrapeResult,
  SiteCheck,
} from "./types";

const CATEGORIES: CheckCategory[] = [
  "Rendering", "Structured data", "Metadata", "Crawl surface", "Semantics", "Content", "Answerability",
];

function normalizeUrl(input: string): URL {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error(`Unsupported protocol: ${u.protocol}`);
  return u;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await fn(items[i]!);
      }
    }),
  );
  return results;
}

export interface RunScrapeOptions {
  repo?: RepoInput | null;
  singlePage?: boolean;
  maxPages?: number;
  maxPerSection?: number;
  concurrency?: number;
  onLog?: (entry: LogEntry) => void | Promise<void>;
}

// Scores one already-fetched page through every check activity.
async function scorePage(
  pageUrl: string,
  domain: DomainFiles,
): Promise<PageReport | null> {
  const raw = pageUrl ? await rawFetch(pageUrl) : null;
  if (!raw) return null;
  const block = detectBlock(raw);
  if (block || !raw.ok) {
    return {
      url: pageUrl,
      pageType: "generic",
      fetch: { status: raw.status, ok: false, blocked: !!block, blockReason: block ?? `HTTP ${raw.status}` },
      score: { overall: 0, status: "FAILED", pointsEarned: 0, pointsPossible: 0 },
      checks: [],
    };
  }
  const page = parsePage(raw);
  const pageType = classifyPage(page);
  // Probe the Markdown-twin / content-negotiation delivery layer (dualmark-style
  // AEO conformance). Best-effort: a failed probe scores the checks as FAILED.
  const twin = await probeTwin(page.finalUrl, raw.headers);
  const ctx: CheckContext = { url: new URL(page.finalUrl), page, domain, pageType, twin };
  const checks: CheckResultOut[] = ALL_CHECK_NAMES.map((name) => runCheckActivity(name, ctx));
  const s = scoreChecks(checks);
  return {
    url: page.finalUrl,
    pageType,
    fetch: { status: page.status, ok: true, blocked: false, blockReason: null },
    score: { overall: s.overall, status: s.status, pointsEarned: s.pointsEarned, pointsPossible: s.pointsPossible },
    checks,
  };
}

export async function runScrape(websiteUrl: string, options: RunScrapeOptions = {}): Promise<ScrapeResult> {
  const startedAt = new Date();
  const url = normalizeUrl(websiteUrl);
  const notes: string[] = [];
  const logs: LogEntry[] = [];
  let seq = 0;
  const log = async (e: Omit<LogEntry, "seq">) => {
    const entry = { seq: seq++, ...e };
    logs.push(entry);
    if (options.onLog) await options.onLog(entry);
  };

  await log({ level: "info", event: "scan_started", message: `Scanning ${url}` });

  // First activity: repo <-> website match.
  const repoMatch = repoWebsiteMatchActivity(url, options.repo ?? null);
  await log({
    level: repoMatch.status === "FAILED" ? "error" : "info",
    event: "repo_match",
    message: repoMatch.status === "NOT_APPLICABLE" ? "No repo provided; skipped repo match." : `Repo match: ${repoMatch.status} (confidence ${repoMatch.confidence}).`,
    status: repoMatch.status,
  });

  const homeRaw = await rawFetch(url.toString());
  const homeBlock = detectBlock(homeRaw);
  if (homeBlock || !homeRaw.ok) {
    const reason = homeBlock ?? `HTTP ${homeRaw.status}`;
    await log({ level: "error", event: "homepage_failed", message: `Could not read homepage: ${reason}` });
    return finalize(url, startedAt, repoMatch, [], 0, { source: "single", sections: {}, totalDiscovered: 1 }, [reason], logs, "failed", `Could not read the page: ${reason}`);
  }

  const domain = await fetchDomainFiles(homeRaw.finalUrl);
  await log({ level: "info", event: "crawl_files_read", message: "Read robots.txt, sitemap.xml, llms.txt." });

  // Discover pages (unless single-page mode).
  const maxPages = options.singlePage ? 1 : (options.maxPages ?? 20);
  const maxPerSection = options.maxPerSection ?? 3;
  const discovery = options.singlePage
    ? { selected: [homeRaw.finalUrl], source: "single" as const, totalDiscovered: 1, sections: { "/": 1 } }
    : await discoverPages(homeRaw.finalUrl, homeRaw.body, { maxPages, maxPerSection });
  await log({ level: "info", event: "pages_discovered", message: `${discovery.selected.length} of ${discovery.totalDiscovered} pages selected (source: ${discovery.source}).` });

  // Score every selected page.
  const reports = (await mapWithConcurrency(discovery.selected, options.concurrency ?? 5, async (pageUrl) => {
    const r = await scorePage(pageUrl, domain);
    if (r) {
      await log({
        level: r.fetch.ok ? "info" : "error",
        event: r.fetch.ok ? "page_scored" : "page_failed",
        message: r.fetch.ok ? `Scored ${r.url} (${r.score.overall}, ${r.pageType}).` : `Could not read ${r.url}.`,
        page: r.url,
        status: r.score.status,
      });
    }
    return r;
  })).filter((r): r is PageReport => r !== null);

  const okReports = reports.filter((r) => r.fetch.ok);
  const pagesFailed = reports.length - okReports.length;

  // Aggregate per-check across pages, log each check.
  const siteChecks: SiteCheck[] = [];
  for (const meta of check_intent) {
    const instances = okReports.map((r) => r.checks.find((c) => c.name === meta.name)).filter((c): c is CheckResultOut => !!c);
    const site = aggregateCheck(meta.name, instances, okReports);
    siteChecks.push(site);
    await log({ level: "info", event: "check_evaluated", message: `${meta.name}: ${site.status} (${site.pointsEarned}/${site.pointsPossible})`, check: meta.name, status: site.status });
    if (site.recommendedAction === "add_page" || site.recommendedAction === "add_content") {
      notes.push(`${site.name}: ${site.recommendation ?? site.summary}`);
    }
  }

  return finalize(url, startedAt, repoMatch, siteChecks, okReports.length, discovery, notes, logs, "completed", null);
}

function aggregateCheck(name: string, instances: CheckResultOut[], reports: PageReport[]): SiteCheck {
  const meta = check_intent.find((c) => c.name === name)!;
  const counts = { success: 0, mid: 0, failed: 0, notApplicable: 0, inconclusive: 0 };
  let earned = 0;
  let possible = 0;
  const affected: SiteCheck["affectedPages"] = [];
  let representative: CheckResultOut | undefined;
  let failingRep: CheckResultOut | undefined;

  instances.forEach((c, i) => {
    if (c.status === "SUCCESS") counts.success++;
    else if (c.status === "MID") counts.mid++;
    else if (c.status === "FAILED") counts.failed++;
    else if (c.status === "NOT_APPLICABLE") counts.notApplicable++;
    else counts.inconclusive++;
    earned += c.pointsEarned;
    possible += c.pointsPossible;
    representative ??= c;
    if (c.status === "FAILED" || c.status === "MID") {
      failingRep ??= c;
      affected.push({
        page: reports[i]?.url ?? "",
        status: c.status,
        issue: c.evidence ? `${c.summary} (${c.evidence})` : c.summary,
        recommendation: c.recommendation ?? c.fixHint ?? null,
      });
    }
  });

  const applicablePages = counts.success + counts.mid + counts.failed;
  const rep = failingRep ?? representative;
  let status: SiteCheck["status"];
  if (applicablePages === 0) {
    status = counts.inconclusive > 0 ? "INCONCLUSIVE" : "NOT_APPLICABLE";
  } else {
    status = bandFor(possible > 0 ? Math.round((earned / possible) * 100) : 0);
  }

  return {
    name: meta.name,
    category: meta.category,
    tier: meta.tier,
    scope: meta.scope,
    fixableByAgent: meta.fixableByAgent,
    weight: meta.weight,
    status,
    pointsEarned: earned,
    pointsPossible: possible,
    applicablePages,
    counts,
    summary: rep?.summary ?? "Not evaluated.",
    recommendation: rep?.recommendation ?? null,
    recommendedAction: rep?.recommendedAction ?? "none",
    affectedPages: affected.slice(0, 25),
  };
}

function finalize(
  url: URL,
  startedAt: Date,
  repoMatch: ScrapeResult["repoMatch"],
  siteChecks: SiteCheck[],
  pagesChecked: number,
  discovery: { source: string; sections: Record<string, number>; totalDiscovered: number },
  notes: string[],
  logs: LogEntry[],
  status: "completed" | "failed",
  error: string | null,
): ScrapeResult {
  const finishedAt = new Date();
  const earned = siteChecks.reduce((a, c) => a + c.pointsEarned, 0);
  const possible = siteChecks.reduce((a, c) => a + c.pointsPossible, 0);
  const overall = possible > 0 ? Math.round((earned / possible) * 100) : 0;

  const byCategory = {} as Record<CheckCategory, CategoryScoreOut>;
  for (const cat of CATEGORIES) {
    const members = siteChecks.filter((c) => c.category === cat);
    const e = members.reduce((a, c) => a + c.pointsEarned, 0);
    const p = members.reduce((a, c) => a + c.pointsPossible, 0);
    const sc = p > 0 ? Math.round((e / p) * 100) : 0;
    byCategory[cat] = { score: sc, status: p > 0 ? bandFor(sc) : "NOT_APPLICABLE", pointsEarned: e, pointsPossible: p };
  }

  return {
    url: url.toString(),
    finalUrl: url.toString(),
    rubricVersion: RUBRIC_VERSION,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    repoMatch,
    score: { overall, status: bandFor(overall), pointsEarned: earned, pointsPossible: possible, byCategory },
    crawl: {
      source: discovery.source,
      pagesDiscovered: discovery.totalDiscovered,
      pagesChecked,
      pagesFailed: 0,
      sections: discovery.sections,
    },
    checks: siteChecks,
    logs,
    notes,
    error,
  };
}
