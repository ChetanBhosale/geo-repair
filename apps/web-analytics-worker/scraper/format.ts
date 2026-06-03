// Human-readable terminal formatter for a ScoreReport. Pure string building, no deps.

import type { ScoreReport, SiteReport, Status } from "./types.ts";

const STATUS_MARK: Record<Status, string> = {
  pass: "PASS",
  partial: "PART",
  fail: "FAIL",
  inconclusive: "INC ",
  "not-applicable": "N/A ",
};

function bar(score: number, width = 20): string {
  const filled = Math.round((score / 100) * width);
  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}] ${score}/100`;
}

export function formatReport(report: ScoreReport): string {
  const lines: string[] = [];
  lines.push("=".repeat(72));
  lines.push(`AI Search Readiness Report  (rubric ${report.rubricVersion})`);
  lines.push(`URL:      ${report.url}`);
  if (report.finalUrl !== report.url) lines.push(`Resolved: ${report.finalUrl}`);
  lines.push(`Page type: ${report.pageType}`);
  lines.push(`Fetched:  ${report.fetchedAt}  (${report.durationMs}ms, tier ${report.fetch.tier})`);
  lines.push("=".repeat(72));

  if (report.fetch.blocked) {
    lines.push("");
    lines.push(`INCONCLUSIVE: ${report.fetch.blockReason}`);
    lines.push("The site could not be read, so no score was assigned (not counted as a failure).");
    return lines.join("\n");
  }

  lines.push("");
  lines.push(`OVERALL   ${bar(report.overall)}`);
  lines.push(`  SEO     ${bar(report.pillars.seo.score)}   (${report.pillars.seo.checks} checks)`);
  lines.push(`  GEO     ${bar(report.pillars.geo.score)}   (${report.pillars.geo.checks} checks, reachable by AI)`);
  lines.push(`  AEO     ${bar(report.pillars.aeo.score)}   (${report.pillars.aeo.checks} checks, answer-ready)`);

  lines.push("");
  lines.push("By category:");
  for (const [cat, s] of Object.entries(report.categories)) {
    if (s) lines.push(`  ${cat.padEnd(18)} ${bar(s.score, 12)}`);
  }

  lines.push("");
  lines.push("-".repeat(72));
  lines.push("Checks:");
  for (const c of report.checks) {
    lines.push(`  [${STATUS_MARK[c.status]}] ${c.id.padEnd(20)} (${c.category})`);
    lines.push(`         ${c.reason}`);
    if (c.bad.length) lines.push(`         issues: ${c.bad.join("; ")}`);
    if (c.evidence) lines.push(`         evidence: ${c.evidence}`);
    if (c.fixHint && (c.status === "fail" || c.status === "partial")) {
      lines.push(`         fix: ${c.fixHint}`);
    }
  }

  const { good, bad, missing, inconclusive } = report.summary;
  lines.push("");
  lines.push("-".repeat(72));
  lines.push(`What is good (${good.length}):`);
  for (const g of good) lines.push(`  + ${g}`);
  lines.push("");
  lines.push(`What is missing (${missing.length}):`);
  for (const m of missing) lines.push(`  - ${m}`);
  lines.push("");
  lines.push(`What went wrong (${bad.length}):`);
  for (const b of bad) lines.push(`  ! ${b}`);
  if (inconclusive.length) {
    lines.push("");
    lines.push(`Inconclusive (${inconclusive.length}):`);
    for (const i of inconclusive) lines.push(`  ? ${i}`);
  }

  if (report.advisories.length) {
    lines.push("");
    lines.push("-".repeat(72));
    lines.push("Advisory (not in the score, planned / needs more infrastructure):");
    for (const a of report.advisories) {
      lines.push(`  ~ [${a.status}] ${a.label}`);
      lines.push(`         ${a.detail}`);
      if (a.observed) lines.push(`         observed: ${a.observed}`);
      if (a.needs) lines.push(`         needs: ${a.needs}`);
    }
  }
  lines.push("=".repeat(72));
  return lines.join("\n");
}

/** Terminal formatter for a multi-page SiteReport. */
export function formatSiteReport(site: SiteReport): string {
  const lines: string[] = [];
  lines.push("=".repeat(72));
  lines.push(`AI Search Readiness: SITE report  (rubric ${site.rubricVersion})`);
  lines.push(`Site:     ${site.url}`);
  lines.push(`Fetched:  ${site.fetchedAt}  (${site.durationMs}ms)`);
  lines.push("=".repeat(72));

  lines.push("");
  lines.push(`SITE OVERALL  ${bar(site.overall)}   (mean of ${site.crawl.pagesScraped} page(s))`);
  lines.push(`  SEO     ${bar(site.pillars.seo.score)}`);
  lines.push(`  GEO     ${bar(site.pillars.geo.score)}`);
  lines.push(`  AEO     ${bar(site.pillars.aeo.score)}`);

  // Site profile.
  const info = site.siteInfo;
  lines.push("");
  lines.push("-".repeat(72));
  lines.push("About this site:");
  if (info.name) lines.push(`  Name:        ${info.name}`);
  if (info.description) lines.push(`  Description: ${info.description.slice(0, 140)}`);
  if (info.language) lines.push(`  Language:    ${info.language}`);
  if (info.techStack.length) lines.push(`  Tech:        ${info.techStack.join(", ")}`);
  if (info.schemaTypes.length) lines.push(`  Schema:      ${info.schemaTypes.join(", ")}`);
  if (info.socialProfiles.length) lines.push(`  Social:      ${info.socialProfiles.slice(0, 6).join(", ")}`);
  if (info.emails.length) lines.push(`  Email:       ${info.emails.join(", ")}`);
  if (info.phones.length) lines.push(`  Phone:       ${info.phones.join(", ")}`);
  const ptParts = Object.entries(info.pageTypes).filter(([, n]) => n > 0).map(([t, n]) => `${t}: ${n}`);
  if (ptParts.length) lines.push(`  Page mix:    ${ptParts.join(", ")}`);
  lines.push(`  Files:       sitemap ${info.hasSitemap ? "yes" : "no"}, robots ${info.hasRobots ? "yes" : "no"}, llms.txt ${info.hasLlmsTxt ? "yes" : "no"}`);
  lines.push(`  Content:     ${info.content.avgWordsPerPage} avg words/page, ${info.content.pagesWithStructuredData}/${info.content.pagesScored} pages with structured data` + (info.sitemapUrlCount ? `, ~${info.sitemapUrlCount} URLs in sitemap` : ""));

  lines.push("");
  lines.push("By category (site mean):");
  for (const [cat, s] of Object.entries(site.categories)) {
    lines.push(`  ${cat.padEnd(18)} ${bar(s.score, 12)}`);
  }

  // Discovery transparency: how we picked pages.
  lines.push("");
  lines.push("-".repeat(72));
  lines.push(`Crawl: source=${site.crawl.source}, discovered ${site.crawl.totalDiscovered} URL(s), scraped ${site.crawl.pagesScraped} (cap ${site.crawl.maxPages}).`);
  const sectionPairs = Object.entries(site.crawl.sections).sort((a, b) => b[1] - a[1]);
  if (sectionPairs.length) {
    lines.push(`Sections found: ${sectionPairs.map(([s, n]) => `${s} (${n})`).join(", ")}`);
  }

  lines.push("");
  lines.push("-".repeat(72));
  lines.push("Per-page scores (overall | SEO / GEO / AEO):");
  for (const p of site.pages) {
    if (p.blocked) {
      lines.push(`  [INC]  ${p.pageType.padEnd(13)} ${p.finalUrl}`);
      continue;
    }
    const o = String(p.overall).padStart(3);
    const s = String(p.pillars.seo.score).padStart(3);
    const g = String(p.pillars.geo.score).padStart(3);
    const a = String(p.pillars.aeo.score).padStart(3);
    lines.push(`  ${o}  ${p.pageType.padEnd(13)} S${s} G${g} A${a}  ${p.finalUrl}`);
  }
  if (site.crawl.skippedSample.length) {
    lines.push("");
    lines.push(`Skipped (sample of ${site.crawl.skippedSample.length} not scraped):`);
    for (const u of site.crawl.skippedSample.slice(0, 8)) lines.push(`  . ${u}`);
  }

  // Site-wide check rollup: where each check fails across pages.
  lines.push("");
  lines.push("-".repeat(72));
  lines.push("Site-wide checks (pages pass/partial/fail):");
  for (const c of site.checkRollup) {
    const total = c.pass + c.partial + c.fail + c.inconclusive + c.notApplicable;
    lines.push(`  ${c.id.padEnd(20)} ${c.pass}P / ${c.partial}~ / ${c.fail}F  (of ${total})`);
    if (c.failingUrls.length) {
      lines.push(`         fails on: ${c.failingUrls.slice(0, 5).join(", ")}${c.failingUrls.length > 5 ? " ..." : ""}`);
    }
  }

  // Per-pillar good / bad / missing rollup.
  const pillarLabels: Record<string, string> = { seo: "SEO", geo: "GEO (reachable by AI)", aeo: "AEO (answer-ready)" };
  lines.push("");
  lines.push("-".repeat(72));
  lines.push("By pillar:");
  for (const p of ["seo", "geo", "aeo"] as const) {
    const ps = site.pillarSummary[p];
    lines.push("");
    lines.push(`${pillarLabels[p]}  ${bar(site.pillars[p].score, 12)}`);
    if (ps.good.length) {
      lines.push(`  good (${ps.good.length}):`);
      for (const g of ps.good) lines.push(`    + ${g}`);
    }
    if (ps.missing.length) {
      lines.push(`  missing (${ps.missing.length}):`);
      for (const m of ps.missing) lines.push(`    - ${m}`);
    }
    if (ps.bad.length) {
      lines.push(`  needs work (${ps.bad.length}):`);
      for (const b of ps.bad) lines.push(`    ! ${b}`);
    }
  }

  // Per-page fix list (worst first).
  if (site.fixesRequired.length) {
    lines.push("");
    lines.push("-".repeat(72));
    lines.push(`Fixes required (${site.fixesRequired.length} page(s) need work, worst first):`);
    for (const pf of site.fixesRequired.slice(0, 30)) {
      lines.push("");
      lines.push(`  ${pf.url}  [${pf.pageType}, score ${pf.overall}]`);
      for (const f of pf.fixes) {
        const tag = f.status === "fail" ? "FAIL" : "PART";
        const auto = f.fixableByAgent ? "" : " (flag only)";
        lines.push(`    [${tag}] ${f.checkId}${auto}: ${f.fix}`);
      }
    }
    if (site.fixesRequired.length > 30) {
      lines.push("");
      lines.push(`  ... and ${site.fixesRequired.length - 30} more pages in the JSON output.`);
    }
  }

  if (site.advisories.length) {
    lines.push("");
    lines.push("-".repeat(72));
    lines.push("Advisory (not in the score):");
    for (const a of site.advisories) {
      lines.push(`  ~ [${a.status}] ${a.label}`);
    }
  }
  lines.push("=".repeat(72));
  return lines.join("\n");
}
