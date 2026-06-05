// Advisory diagnostics: surfaced in the report but NEVER folded into the 0-100 score.
// These cover the signals a Tier 0 static reader cannot honestly measure yet (Core Web Vitals,
// multi-page aggregation, off-site citations, JS rendering). Mirrors RUBRIC.md "Advisory, never
// scored" + "Agentic readiness", and AGENTS.md honesty rule (score technical readiness only).
//
// Each item states what is not covered, what would unlock it, and any static hint we already saw,
// so the report is honest about scope instead of silently omitting these.

import type { AdvisoryItem, CheckContext } from "./types.ts";

export function buildAdvisories(ctx: CheckContext): AdvisoryItem[] {
  const { page, domain } = ctx;
  const items: AdvisoryItem[] = [];

  // 1) Core Web Vitals / performance. Needs real rendering or field data, not static HTML.
  const heavyHints: string[] = [];
  if (page.scriptCount >= 15)
    heavyHints.push(`${page.scriptCount} script tags`);
  if (page.htmlByteLength > 1_000_000) {
    heavyHints.push(`${Math.round(page.htmlByteLength / 1024)} KB HTML`);
  }
  items.push({
    id: "core-web-vitals",
    label: "Core Web Vitals & performance (LCP, INP, CLS, TTFB, page weight)",
    status: "not-measured",
    detail:
      "Performance and layout-stability are a ranking pillar but cannot be measured from static HTML. We do not score them, so the overall number is not a performance grade.",
    needs: "Tier 1 (Playwright) timings or the PageSpeed Insights / CrUX API",
    observed: heavyHints.length
      ? `static hints: ${heavyHints.join(", ")}`
      : null,
  });

  // 2) Multi-page crawl. We audited a single URL; real audits aggregate across key pages.
  items.push({
    id: "multi-page-crawl",
    label: "Multi-page (site-wide) audit",
    status: "planned",
    detail:
      "This run scored a single page. Site-wide issues (duplicate titles/descriptions, orphan pages, inconsistent schema) need a crawl of key pages and are not reflected here.",
    needs:
      "Sitemap-driven crawl of homepage + key pages, then per-check aggregation",
    observed: domain.sitemap.ok
      ? `sitemap lists ${domain.sitemap.urlCount} URL(s) available to crawl`
      : "no usable sitemap found to seed a crawl",
  });

  // 3) Off-site citation diagnostic. Lives on third-party sites; never scorable or fixable by a PR.
  items.push({
    id: "offsite-citations",
    label: "Off-site citation placement (who AI cites in your category)",
    status: "not-measured",
    detail:
      "Whether AI engines cite third-party roundups instead of you is a placement signal on sites we do not control. It is non-deterministic, never scored, and cannot be fixed by a repo PR.",
    needs:
      "Querying ChatGPT / Perplexity for category questions (diagnostic only, respect ToS)",
    observed: null,
  });

  // 4) JS rendering (Tier 1). SPAs currently surface as an ssr-visibility failure, not rendered.
  items.push({
    id: "js-rendering",
    label: "JavaScript-rendered content (Tier 1)",
    status: page.spaRootDetected ? "not-measured" : "planned",
    detail: page.spaRootDetected
      ? "This page looks client-rendered, so the static read may understate its real content. We report ssr-visibility as a likely failure rather than executing JavaScript."
      : "We read the raw no-JS HTML only. Content injected purely by client JavaScript is not seen.",
    needs:
      "Tier 1 headless render (Playwright + stealth) with the block detector",
    observed: page.spaRootDetected
      ? `SPA shell detected (wordCount=${page.wordCount}, scripts=${page.scriptCount})`
      : null,
  });

  return items;
}
