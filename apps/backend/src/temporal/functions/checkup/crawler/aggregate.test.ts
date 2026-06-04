// Unit tests for the rubric-centric aggregation: folding many per-page checks into one
// finding per check. Verifies counts, siteStatus, affectedCount, representativeEvidence, scope,
// and the page-sample cap.

import { test, expect } from "bun:test";
import { aggregateSite, deriveWebsiteType, type ScoredPage } from "./aggregate.ts";
import {
  CATEGORIES,
  PILLARS,
  type Category,
  type CategoryScore,
  type CheckResult,
  type CrawlInfo,
  type DomainFiles,
  type PageModel,
  type Pillar,
  type PillarScore,
  type ScoreReport,
  type Status,
} from "./types.ts";

function pillarScores(): Record<Pillar, PillarScore> {
  const out = {} as Record<Pillar, PillarScore>;
  for (const p of PILLARS) out[p] = { score: 50, earned: 1, applicable: 2, checks: 2 };
  return out;
}

function categoryScores(): Record<Category, CategoryScore> {
  const out = {} as Record<Category, CategoryScore>;
  for (const c of CATEGORIES) out[c] = { score: 50, earned: 1, applicable: 2 };
  return out;
}

function check(id: string, status: Status, opts: Partial<CheckResult> = {}): CheckResult {
  return {
    id,
    category: opts.category ?? "Metadata",
    pillars: opts.pillars ?? ["seo"],
    tier: opts.tier ?? "A",
    fixableByAgent: opts.fixableByAgent ?? true,
    weight: opts.weight ?? 12,
    status,
    reason: opts.reason ?? "",
    good: opts.good ?? [],
    bad: opts.bad ?? [],
    evidence: opts.evidence ?? null,
    fixHint: opts.fixHint ?? null,
  };
}

function scoredPage(
  url: string,
  checks: CheckResult[],
  blocked = false,
  page: PageModel | null = null,
): ScoredPage {
  const report: ScoreReport = {
    url,
    finalUrl: url,
    fetchedAt: "2026-06-04T00:00:00.000Z",
    durationMs: 1,
    rubricVersion: "v1",
    pageType: "generic",
    fetch: { requestedUrl: url, finalUrl: url, status: blocked ? 403 : 200, ok: !blocked, blocked, blockReason: blocked ? "blocked" : null, tier: "static" },
    overall: 50,
    pillars: pillarScores(),
    categories: categoryScores(),
    checks,
    advisories: [],
    summary: { good: [], bad: [], missing: [], inconclusive: [] },
  };
  return { report, page };
}

function pageModel(url: string, rawHtml: string, headers: Record<string, string> = {}): PageModel {
  return {
    requestedUrl: url,
    finalUrl: url,
    status: 200,
    ok: true,
    contentType: "text/html",
    headers,
    rawHtml,
    htmlByteLength: rawHtml.length,
    hasDoctype: true,
    charsetEarly: true,
    charsetValue: "utf-8",
    htmlLang: "en",
    viewport: "width=device-width, initial-scale=1",
    viewportResponsive: true,
    title: "Example",
    metas: [],
    links: [],
    canonical: url,
    metaRobots: null,
    xRobotsTag: null,
    jsonLd: [],
    headings: [{ level: 1, text: "Example" }],
    anchors: [],
    images: [],
    interactives: [],
    landmarks: { header: true, nav: true, main: true, footer: true },
    labelFor: new Set<string>(),
    visibleText: "Example page",
    wordCount: 2,
    scriptCount: 0,
    spaRootDetected: false,
    noscriptText: "",
    metaByKey: new Map<string, string>(),
  };
}

const domain: DomainFiles = {
  origin: "https://example.com",
  sitemapUrl: "https://example.com/sitemap.xml",
  robots: { fetched: true, status: 200, content: "", sitemaps: [], blocksGooglebot: false, aiCrawlerRules: [] },
  sitemap: { fetched: true, status: 200, ok: true, isXml: true, isIndex: false, urlCount: 3, referencedInRobots: true, urls: [] },
  llmsTxt: { fetched: false, status: 404, ok: false, nonEmpty: false, hasLinks: false },
};

const crawl: CrawlInfo = {
  source: "sitemap",
  totalDiscovered: 3,
  pagesChecked: 3,
  maxPages: 3,
  sections: {},
  checkedUrls: [],
  skippedSample: [],
};

function aggregate(pages: ScoredPage[]) {
  return aggregateSite("https://example.com", domain, Date.now(), "v1", crawl, pages);
}

test("folds 3 pages into one finding per check id (not per page)", () => {
  const pages = [
    scoredPage("https://example.com/a", [check("meta-tags", "fail", { evidence: "app/layout.tsx" }), check("canonical-urls", "pass")]),
    scoredPage("https://example.com/b", [check("meta-tags", "fail"), check("canonical-urls", "pass")]),
    scoredPage("https://example.com/c", [check("meta-tags", "fail"), check("canonical-urls", "pass")]),
  ];
  const site = aggregate(pages);

  // 2 distinct checks across 3 pages -> 2 findings, not 6.
  expect(site.findings.length).toBe(2);
  expect(site.pageIndex.length).toBe(3);
});

test("a check failing on every page becomes one finding with affectedCount = N", () => {
  const pages = [
    scoredPage("https://example.com/a", [check("meta-tags", "fail", { evidence: "app/layout.tsx" })]),
    scoredPage("https://example.com/b", [check("meta-tags", "fail", { evidence: "app/b/page.tsx" })]),
    scoredPage("https://example.com/c", [check("meta-tags", "fail")]),
  ];
  const meta = aggregate(pages).findings.find((f) => f.id === "meta-tags")!;

  expect(meta.counts.fail).toBe(3);
  expect(meta.siteStatus).toBe("fail");
  expect(meta.affectedCount).toBe(3);
  // representative evidence = the first offending file we saw.
  expect(meta.representativeEvidence).toBe("app/layout.tsx");
});

test("all-pass check -> siteStatus pass, affectedCount 0", () => {
  const pages = [
    scoredPage("https://example.com/a", [check("canonical-urls", "pass")]),
    scoredPage("https://example.com/b", [check("canonical-urls", "pass")]),
  ];
  const f = aggregate(pages).findings.find((c) => c.id === "canonical-urls")!;
  expect(f.siteStatus).toBe("pass");
  expect(f.affectedCount).toBe(0);
  expect(f.pages.length).toBe(0);
});

test("mixed fail/partial/pass -> siteStatus mixed, counts exact", () => {
  const pages = [
    scoredPage("https://example.com/a", [check("open-graph", "fail")]),
    scoredPage("https://example.com/b", [check("open-graph", "partial")]),
    scoredPage("https://example.com/c", [check("open-graph", "pass")]),
  ];
  const f = aggregate(pages).findings.find((c) => c.id === "open-graph")!;
  expect(f.counts).toEqual({ pass: 1, partial: 1, fail: 1, inconclusive: 0, notApplicable: 0 });
  expect(f.siteStatus).toBe("mixed");
  expect(f.affectedCount).toBe(2); // fail + partial
});

test("scope is derived from the registry (site-wide vs per-page)", () => {
  const pages = [
    scoredPage("https://example.com/a", [
      check("robots-ai-crawlers", "fail", { category: "Crawl surface", pillars: ["geo"] }),
      check("definitions", "fail", { category: "Answerability", pillars: ["aeo"] }),
    ]),
  ];
  const findings = aggregate(pages).findings;
  expect(findings.find((f) => f.id === "robots-ai-crawlers")!.scope).toBe("site-wide");
  expect(findings.find((f) => f.id === "definitions")!.scope).toBe("per-page");
});

test("per-finding page sample is capped but counts stay exact", () => {
  const pages = Array.from({ length: 120 }, (_, i) =>
    scoredPage(`https://example.com/p${i}`, [check("meta-tags", "fail", { evidence: `route-${i}` })]),
  );
  const f = aggregate(pages).findings.find((c) => c.id === "meta-tags")!;
  expect(f.counts.fail).toBe(120); // exact
  expect(f.affectedCount).toBe(120); // exact
  expect(f.pages.length).toBe(50); // capped sample (PAGE_SAMPLE_CAP)
});

test("blocked pages are excluded from findings but still indexed", () => {
  const pages = [
    scoredPage("https://example.com/a", [check("meta-tags", "fail")]),
    scoredPage("https://example.com/blocked", [], true),
  ];
  const site = aggregate(pages);
  expect(site.pageIndex.length).toBe(2);
  expect(site.pageIndex.find((p) => p.blocked)!.url).toBe("https://example.com/blocked");
  // the blocked page contributed no checks, so meta-tags counts only the readable page.
  expect(site.findings.find((f) => f.id === "meta-tags")!.counts.fail).toBe(1);
});

test("website type derives framework before hosting signals", () => {
  expect(deriveWebsiteType(["Next.js", "Vercel", "Cloudflare"])).toBe("nextjs");
  expect(deriveWebsiteType(["React", "Netlify"])).toBe("react");
});

test("website type covers supported builders and CMS signals", () => {
  expect(deriveWebsiteType(["Framer", "Cloudflare"])).toBe("framer");
  expect(deriveWebsiteType(["Webflow"])).toBe("webflow");
  expect(deriveWebsiteType(["Wix"])).toBe("wix");
  expect(deriveWebsiteType(["WordPress"])).toBe("wordpress");
  expect(deriveWebsiteType(["Shopify"])).toBe("shopify");
});

test("website type stays unknown for hosting-only or empty signals", () => {
  expect(deriveWebsiteType(["Vercel"])).toBe("unknown");
  expect(deriveWebsiteType(["Cloudflare", "Netlify"])).toBe("unknown");
  expect(deriveWebsiteType([])).toBe("unknown");
});

test("Framer-hosted image assets do not mark a custom Next.js site as Framer", () => {
  const url = "https://example.com";
  const page = pageModel(
    url,
    '<html><head><link rel="preload" as="image" href="https://framerusercontent.com/images/example.webp"><link rel="stylesheet" href="/_next/static/css/app.css"></head><body><h1>Example</h1></body></html>',
  );
  const site = aggregate([
    scoredPage(url, [check("ssr-visibility", "pass")], false, page),
  ]);

  expect(site.siteInfo.techStack).toEqual(["Next.js"]);
  expect(site.siteInfo.websiteType).toBe("nextjs");
});

test("website type falls back to other for non-hosting unknown signals", () => {
  expect(deriveWebsiteType(["Custom CMS"])).toBe("other");
});
