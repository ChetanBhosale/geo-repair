// Aggregate several per-page scrapes into one rubric-centric SiteReport.
//
// The report is keyed on the ~23 rubric CHECKS, not on pages: every page's CheckResult[] folds
// into one RubricFinding per check (status counts + a capped sample of affected pages), so a
// 1000-page site yields ~23 findings, not 23,000 embedded results. Site overall / pillars /
// categories = the mean across READABLE pages (a blocked page does not drag the average to 0).
// SiteInfo (identity, tech, contacts, page mix, content stats) is built from the parsed page
// models. The heavy per-page reports are not retained on the SiteReport — only the compact
// pageIndex and the per-finding page samples.

import { classifyPage } from "./pagetype.ts";
import { findingScope } from "./checks.ts";
import { CATEGORIES, PAGE_TYPES, PILLARS } from "./types.ts";
import type {
  Category,
  CategoryScore,
  CrawlInfo,
  DomainFiles,
  PageIndexEntry,
  PageModel,
  PageType,
  Pillar,
  PillarScore,
  PillarSummary,
  RubricFinding,
  RubricFindingPage,
  ScoreReport,
  SiteInfo,
  SiteReport,
} from "./types.ts";

/** Cap on the affected-page sample retained per finding. Counts stay exact; the list is a sample. */
const PAGE_SAMPLE_CAP = 50;

/** A scored page plus its parsed model (model is null when the page was blocked/unreadable). */
export interface ScoredPage {
  report: ScoreReport;
  page: PageModel | null;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function emptyCategories(): Record<Category, CategoryScore> {
  const out = {} as Record<Category, CategoryScore>;
  for (const cat of CATEGORIES) out[cat] = { score: 0, earned: 0, applicable: 0 };
  return out;
}

/** Derive the site-wide status of a check from its per-page status counts. */
function siteStatusFrom(counts: RubricFinding["counts"]): RubricFinding["siteStatus"] {
  const scored = counts.pass + counts.partial + counts.fail;
  if (scored === 0) return "not-applicable";
  if (counts.fail === 0 && counts.partial === 0) return "pass";
  if (counts.fail === scored) return "fail";
  if (counts.pass === 0 && counts.fail === 0) return "partial"; // everything partial
  return "mixed";
}

// A finding under construction: same shape as RubricFinding minus the derived siteStatus.
type FindingAcc = Omit<RubricFinding, "siteStatus">;

/**
 * Fold every readable page's CheckResult[] into one accumulator per check id. This is the core of
 * the rubric-centric inversion and the unit the streaming/batched scan will reuse: it keeps only
 * exact counts + a capped affected-page sample, never the heavy per-page reports.
 */
function buildFindings(readable: ScoredPage[]): RubricFinding[] {
  const acc = new Map<string, FindingAcc>();

  for (const { report } of readable) {
    for (const c of report.checks) {
      let f = acc.get(c.id);
      if (!f) {
        f = {
          id: c.id,
          category: c.category,
          pillars: c.pillars,
          tier: c.tier,
          fixableByAgent: c.fixableByAgent,
          weight: c.weight,
          scope: findingScope(c.id),
          counts: { pass: 0, partial: 0, fail: 0, inconclusive: 0, notApplicable: 0 },
          affectedCount: 0,
          representativeEvidence: null,
          pages: [],
        };
        acc.set(c.id, f);
      }

      switch (c.status) {
        case "pass":
          f.counts.pass += 1;
          break;
        case "partial":
          f.counts.partial += 1;
          break;
        case "fail":
          f.counts.fail += 1;
          break;
        case "inconclusive":
          f.counts.inconclusive += 1;
          break;
        case "not-applicable":
          f.counts.notApplicable += 1;
          break;
      }

      if (c.status === "fail" || c.status === "partial") {
        f.affectedCount += 1;
        if (!f.representativeEvidence && c.evidence) f.representativeEvidence = c.evidence;
        if (f.pages.length < PAGE_SAMPLE_CAP) {
          const entry: RubricFindingPage = { url: report.finalUrl, status: c.status, evidence: c.evidence };
          f.pages.push(entry);
        }
      }
    }
  }

  return [...acc.values()]
    .map((f) => ({ ...f, siteStatus: siteStatusFrom(f.counts) }))
    // Worst + heaviest first: highest weight, then most affected pages.
    .sort((a, b) => b.weight - a.weight || b.affectedCount - a.affectedCount);
}

export function aggregateSite(
  url: string,
  domain: DomainFiles,
  start: number,
  rubricVersion: string,
  crawl: CrawlInfo,
  scored: ScoredPage[],
): SiteReport {
  const readable = scored.filter((s) => !s.report.fetch.blocked);

  // --- site pillars: mean of per-page pillar scores, only over pages where the pillar applied ---
  // (a page whose checks for a pillar were all not-applicable is excluded, so it does not drag
  //  the average to 0 - this is what makes page-type applicability actually work site-wide.)
  const pillars = {} as Record<Pillar, PillarScore>;
  for (const p of PILLARS) {
    const contributing = readable.filter((s) => s.report.pillars[p].applicable > 0);
    const scores = contributing.map((s) => s.report.pillars[p].score);
    const earned = contributing.reduce((a, s) => a + s.report.pillars[p].earned, 0);
    const applicable = contributing.reduce((a, s) => a + s.report.pillars[p].applicable, 0);
    const checks = contributing.reduce((a, s) => a + s.report.pillars[p].checks, 0);
    pillars[p] = { score: mean(scores), earned, applicable, checks };
  }

  // --- site categories: mean of per-page category scores, only over pages where it applied ---
  const categories = emptyCategories();
  for (const cat of CATEGORIES) {
    const contributing = readable.filter((s) => s.report.categories[cat].applicable > 0);
    const scores = contributing.map((s) => s.report.categories[cat].score);
    const earned = contributing.reduce((a, s) => a + s.report.categories[cat].earned, 0);
    const applicable = contributing.reduce((a, s) => a + s.report.categories[cat].applicable, 0);
    categories[cat] = { score: mean(scores), earned, applicable };
  }

  const overall = mean(readable.map((s) => s.report.overall));

  // --- rubric-centric findings (the primary structure) ---
  const findings = buildFindings(readable);

  // --- compact per-page index (no per-check detail) ---
  const pageIndex: PageIndexEntry[] = scored.map((s) => ({
    url: s.report.url,
    finalUrl: s.report.finalUrl,
    ok: s.report.fetch.ok,
    blocked: s.report.fetch.blocked,
    pageType: s.page ? classifyPage(s.page) : ("generic" as PageType),
    title: s.page?.title ?? null,
    overall: s.report.overall,
    pillars: s.report.pillars,
  }));

  const advisories = (readable[0] ?? scored[0])?.report.advisories ?? [];
  const summary = buildSiteSummary(findings, readable.length);
  const siteInfo = buildSiteInfo(domain, scored, pageIndex.map((p) => p.pageType));
  const pillarSummary = buildPillarSummary(findings, readable.length);

  return {
    url,
    origin: domain.origin,
    fetchedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    rubricVersion,
    crawl,
    siteInfo,
    overall,
    pillars,
    categories,
    findings,
    pageIndex,
    advisories,
    summary,
    pillarSummary,
  };
}

/** Group findings into good/bad/missing buckets, per pillar (SEO/GEO/AEO). */
function buildPillarSummary(
  findings: RubricFinding[],
  readablePages: number,
): Record<Pillar, PillarSummary> {
  const out = {} as Record<Pillar, PillarSummary>;
  for (const p of PILLARS) out[p] = { good: [], bad: [], missing: [] };
  const pageWord = (n: number) => `${n} page${n === 1 ? "" : "s"}`;

  for (const c of findings) {
    const scored = c.counts.pass + c.counts.partial + c.counts.fail;
    if (scored === 0) continue; // not applicable site-wide, skip
    let bucket: keyof PillarSummary;
    let line: string;
    if (c.counts.fail === 0 && c.counts.partial === 0) {
      bucket = "good";
      line = `${c.id}: passes on all ${pageWord(c.counts.pass)}.`;
    } else if (c.counts.fail === scored) {
      bucket = "missing";
      line = `${c.id}: missing or failing on all ${pageWord(c.counts.fail)}.`;
    } else {
      bucket = "bad";
      line = `${c.id}: fails on ${pageWord(c.counts.fail)}, partial on ${c.counts.partial}, passes on ${c.counts.pass} (of ${readablePages}).`;
    }
    // A check can belong to more than one pillar (e.g. structured-data -> geo + aeo).
    for (const pillar of c.pillars) out[pillar][bucket].push(line);
  }
  return out;
}

/** Site-wide good/bad/missing/inconclusive rollup from the per-check finding counts. */
function buildSiteSummary(findings: RubricFinding[], readablePages: number): SiteReport["summary"] {
  const good: string[] = [];
  const bad: string[] = [];
  const missing: string[] = [];
  const inconclusive: string[] = [];
  const pageWord = (n: number) => `${n} page${n === 1 ? "" : "s"}`;

  for (const c of findings) {
    const scored = c.counts.pass + c.counts.partial + c.counts.fail;
    if (scored === 0) {
      inconclusive.push(`${c.id}: not applicable or unreadable across the site.`);
    } else if (c.counts.fail === 0 && c.counts.partial === 0) {
      good.push(`${c.id}: passes on all ${pageWord(c.counts.pass)}.`);
    } else if (c.counts.fail === scored) {
      missing.push(`${c.id}: missing or failing on all ${pageWord(c.counts.fail)}.`);
    } else if (c.counts.fail > 0) {
      bad.push(`${c.id}: fails on ${pageWord(c.counts.fail)}, partial on ${c.counts.partial}, passes on ${c.counts.pass} (of ${readablePages}).`);
    } else {
      bad.push(`${c.id}: partial on ${pageWord(c.counts.partial)}, passes on ${c.counts.pass} (of ${readablePages}).`);
    }
  }
  return { good, bad, missing, inconclusive };
}

// --- SiteInfo extraction ----------------------------------------------------

const SOCIAL_HOST = /(twitter\.com|x\.com|facebook\.com|linkedin\.com|instagram\.com|youtube\.com|github\.com|tiktok\.com|t\.me|mastodon|threads\.net|pinterest\.com|discord\.(gg|com))/i;

function jsonLdStringField(page: PageModel, field: string): string | null {
  for (const block of page.jsonLd) {
    if (!block.valid) continue;
    const m = block.raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`, "i"));
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Detect framework/CMS/CDN hints from headers + HTML of the homepage. */
function detectTech(page: PageModel): string[] {
  const tech = new Set<string>();
  const h = page.headers;
  const html = page.rawHtml;
  const generator = (page.metaByKey.get("generator") ?? "").toLowerCase();

  if ((h["x-powered-by"] ?? "").toLowerCase().includes("next") || h["x-vercel-id"] || /\/_next\//.test(html)) tech.add("Next.js");
  if (h["x-astro-version"] || /astro/i.test(generator)) tech.add("Astro");
  if (/wp-content|wp-includes/i.test(html) || generator.includes("wordpress")) tech.add("WordPress");
  if (generator.includes("shopify") || /cdn\.shopify\.com/i.test(html)) tech.add("Shopify");
  if (generator.includes("webflow") || /\.webflow\./i.test(html)) tech.add("Webflow");
  if (generator.includes("wix")) tech.add("Wix");
  if (generator.includes("hugo")) tech.add("Hugo");
  if (generator.includes("gatsby") || /id=["']___gatsby["']/.test(html)) tech.add("Gatsby");
  if (/id=["']__nuxt["']/.test(html)) tech.add("Nuxt");
  if (/id=["']root["'][^>]*><\/div>/.test(html) && /react/i.test(html)) tech.add("React");
  if ((h["server"] ?? "").toLowerCase().includes("cloudflare") || h["cf-ray"]) tech.add("Cloudflare");
  if (h["x-vercel-id"]) tech.add("Vercel");
  if ((h["server"] ?? "").toLowerCase().includes("netlify")) tech.add("Netlify");

  return [...tech];
}

function buildSiteInfo(
  domain: DomainFiles,
  scored: ScoredPage[],
  pageTypeList: PageType[],
): SiteInfo {
  const models = scored.map((s) => s.page).filter((p): p is PageModel => p !== null);
  const home = models[0] ?? null;

  // Identity.
  const name =
    (home && jsonLdStringField(home, "name")) ||
    home?.metaByKey.get("og:site_name") ||
    home?.title ||
    null;
  const description =
    home?.metaByKey.get("description") || home?.metaByKey.get("og:description") || null;
  const language = home?.htmlLang ?? null;
  const logo =
    (home && jsonLdStringField(home, "logo")) ||
    home?.links.find((l) => /apple-touch-icon/i.test(l.rel ?? ""))?.href ||
    null;
  const favicon = home?.links.find((l) => /(^|\s)icon(\s|$)/i.test(l.rel ?? ""))?.href ?? null;

  // Social profiles + contacts (across all readable pages).
  const social = new Set<string>();
  const emails = new Set<string>();
  const phones = new Set<string>();
  const schemaTypes = new Set<string>();
  let totalWords = 0;
  let pagesWithSd = 0;

  for (const page of models) {
    for (const block of page.jsonLd) {
      if (!block.valid) continue;
      for (const t of block.types) schemaTypes.add(t);
      // sameAs links inside JSON-LD
      const sameAs = block.raw.match(/"sameAs"\s*:\s*\[([^\]]*)\]/i)?.[1] ?? "";
      for (const m of sameAs.matchAll(/"(https?:\/\/[^"]+)"/g)) social.add(m[1]!);
    }
    if (page.jsonLd.some((b) => b.valid)) pagesWithSd += 1;
    totalWords += page.wordCount;
    for (const a of page.anchors) {
      const href = a.href;
      if (!href) continue;
      if (href.startsWith("mailto:")) emails.add(href.slice(7).split("?")[0]!.trim());
      else if (href.startsWith("tel:")) phones.add(href.slice(4).trim());
      else if (SOCIAL_HOST.test(href) && /^https?:\/\//.test(href)) social.add(href.split("?")[0]!);
    }
  }

  const pageTypes = {} as Record<PageType, number>;
  for (const t of PAGE_TYPES) pageTypes[t] = 0;
  for (const t of pageTypeList) pageTypes[t] += 1;

  const pagesScored = models.length;

  return {
    name: name?.trim() || null,
    description: description?.trim() || null,
    language,
    logo,
    favicon,
    socialProfiles: [...social].slice(0, 30),
    emails: [...emails].slice(0, 20),
    phones: [...phones].slice(0, 20),
    techStack: home ? detectTech(home) : [],
    schemaTypes: [...schemaTypes].sort(),
    pageTypes,
    hasSitemap: domain.sitemap.ok,
    hasRobots: domain.robots.fetched,
    hasLlmsTxt: domain.llmsTxt.ok && domain.llmsTxt.nonEmpty,
    sitemapUrlCount: domain.sitemap.isIndex ? 0 : domain.sitemap.urlCount,
    content: {
      totalWords,
      avgWordsPerPage: pagesScored > 0 ? Math.round(totalWords / pagesScored) : 0,
      pagesWithStructuredData: pagesWithSd,
      pagesScored,
    },
  };
}
