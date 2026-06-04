// Human-readable terminal formatter for a ScoreReport / SiteReport. Pure string building, no deps.
//
// Presentation goal: lead with ONE overall score and plain-language groupings, not internal
// pillar jargon or raw weights. SEO/GEO/AEO are surfaced as "Search hygiene", "Reachable by AI",
// and "Answer-ready". The deterministic scoring (score.ts) is unchanged underneath; this file only
// decides what the reader sees first and how dense it is.

import type {
  Pillar,
  ScoreReport,
  SiteReport,
  Status,
} from "./types.ts";

// Customer-facing status words (the JSON keeps the raw pass/partial/fail values for machines).
const STATUS_MARK: Record<Status, string> = {
  pass: "Healthy",
  partial: "Warning",
  fail: "Critical",
  inconclusive: "Unknown",
  "not-applicable": "N/A",
};

/** Plain-language names + one-line meaning for each internal pillar. */
const PILLAR_VIEW: Record<Pillar, { label: string; blurb: string }> = {
  geo: { label: "Reachable by AI", blurb: "can AI crawlers fetch + parse the site" },
  aeo: { label: "Answer-ready", blurb: "can engines extract a direct answer" },
  seo: { label: "Search hygiene", blurb: "classic search fundamentals" },
};
const PILLAR_ORDER: Pillar[] = ["geo", "aeo", "seo"];

function bar(score: number, width = 20): string {
  const filled = Math.round((score / 100) * width);
  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}] ${String(score).padStart(3)}/100`;
}

/** Short plain-language verdict for an overall 0-100 score. */
function verdict(score: number): string {
  if (score >= 85) return "Strong — AI-search ready, only a few gaps to close.";
  if (score >= 70) return "Good — solid foundation, some meaningful gaps to fix.";
  if (score >= 50) return "Needs work — several fundamentals are missing.";
  if (score > 0) return "At risk — largely invisible to AI search today.";
  return "Inconclusive — the site could not be read.";
}

function pillarLine(label: string, score: number, blurb: string): string {
  return `  ${label.padEnd(16)} ${bar(score, 12)}   ${blurb}`;
}

// --- single-page report -----------------------------------------------------

export function formatReport(report: ScoreReport): string {
  const lines: string[] = [];
  lines.push("=".repeat(72));
  lines.push(`AI Search Readiness — ${report.url}`);
  lines.push(`page type: ${report.pageType} · ${report.fetchedAt} · static read`);
  lines.push("=".repeat(72));

  if (report.fetch.blocked) {
    lines.push("");
    lines.push(`INCONCLUSIVE: ${report.fetch.blockReason}`);
    lines.push("The site could not be read, so no score was assigned (not counted as a failure).");
    return lines.join("\n");
  }

  lines.push("");
  lines.push(`  OVERALL  ${bar(report.overall)}   ${verdict(report.overall)}`);
  lines.push("");
  for (const p of PILLAR_ORDER) {
    const v = PILLAR_VIEW[p];
    lines.push(pillarLine(v.label, report.pillars[p].score, v.blurb));
  }

  // Group checks the reader cares about: needs-work first, then a compact "working" line.
  const working = report.checks.filter((c) => c.status === "pass").map((c) => c.id);
  const needs = report.checks.filter((c) => c.status === "fail" || c.status === "partial");
  const na = report.checks.filter((c) => c.status === "not-applicable" || c.status === "inconclusive");

  if (needs.length) {
    lines.push("");
    lines.push("-".repeat(72));
    lines.push(`NEEDS ATTENTION (${needs.length}):`);
    for (const c of needs) {
      lines.push(`  [${STATUS_MARK[c.status].padEnd(8)}] ${c.id} — ${c.reason}`);
      if (c.bad.length) lines.push(`             ${c.bad.join("; ")}`);
      if (c.fixHint) lines.push(`             fix: ${c.fixHint}`);
    }
  }

  lines.push("");
  lines.push("-".repeat(72));
  lines.push(`HEALTHY (${working.length}): ${working.join(", ") || "none"}`);
  if (na.length) {
    lines.push(`Not applicable / couldn't check (${na.length}): ${na.map((c) => c.id).join(", ")}`);
  }

  if (report.advisories.length) {
    lines.push("");
    lines.push("Advisory (not scored — needs more than a static read):");
    for (const a of report.advisories) lines.push(`  ~ [${a.status}] ${a.label}`);
  }
  lines.push("=".repeat(72));
  return lines.join("\n");
}

// --- multi-page site report -------------------------------------------------

export function formatSiteReport(site: SiteReport): string {
  const lines: string[] = [];
  const info = site.siteInfo;

  lines.push("=".repeat(72));
  lines.push(`AI Search Readiness — ${site.url}`);
  lines.push(`${site.crawl.pagesChecked} page(s) analyzed · ${site.fetchedAt} · static read`);
  lines.push("=".repeat(72));

  // 1) The headline: one score + plain-language verdict, then the three plain groupings.
  lines.push("");
  lines.push(`  OVERALL  ${bar(site.overall)}   ${verdict(site.overall)}`);
  lines.push("");
  for (const p of PILLAR_ORDER) {
    const v = PILLAR_VIEW[p];
    lines.push(pillarLine(v.label, site.pillars[p].score, v.blurb));
  }

  // 2) One-line site profile (identity + what it is built with).
  lines.push("");
  const files = `sitemap ${info.hasSitemap ? "yes" : "no"}, robots ${info.hasRobots ? "yes" : "no"}, llms.txt ${info.hasLlmsTxt ? "yes" : "no"}`;
  const facts = [
    info.name,
    info.techStack.join("/") || null,
    info.language,
    info.sitemapUrlCount ? `${info.sitemapUrlCount} URLs` : null,
    files,
  ].filter(Boolean);
  lines.push(`  About: ${facts.join(" · ")}`);
  if (info.schemaTypes.length) lines.push(`  Schema: ${info.schemaTypes.join(", ")}`);

  // 3) Working / needs-work / missing, grouped from the rubric-centric findings (one line per check).
  const working: string[] = [];
  const needsWork: string[] = [];
  const missing: string[] = [];
  for (const c of site.findings) {
    const scored = c.counts.pass + c.counts.partial + c.counts.fail;
    if (scored === 0) continue; // not-applicable / inconclusive everywhere: omit from the headline lists
    if (c.counts.fail === 0 && c.counts.partial === 0) {
      working.push(c.id);
    } else if (c.counts.pass === 0 && c.counts.partial === 0) {
      missing.push(`${c.id} — missing on all ${c.counts.fail} page(s) where it applies`);
    } else {
      const parts = [c.counts.fail ? `${c.counts.fail} fail` : null, c.counts.partial ? `${c.counts.partial} partial` : null, c.counts.pass ? `${c.counts.pass} pass` : null].filter(Boolean);
      needsWork.push(`${c.id} — ${parts.join(" / ")} (of ${scored})`);
    }
  }

  lines.push("");
  lines.push("-".repeat(72));
  lines.push(`HEALTHY (${working.length}): ${working.join(", ") || "none"}`);

  if (needsWork.length) {
    lines.push("");
    lines.push(`WARNINGS (${needsWork.length} — mixed across pages):`);
    for (const l of needsWork) lines.push(`  ${l}`);
  }
  if (missing.length) {
    lines.push("");
    lines.push(`CRITICAL (${missing.length} — failing everywhere it applies):`);
    for (const l of missing) lines.push(`  ${l}`);
  }

  // 4) Top fixes, straight off the rubric-centric findings (already one row per check, worst first).
  const topFixes = site.findings
    .filter((f) => f.affectedCount > 0)
    .sort((a, b) => b.affectedCount - a.affectedCount)
    .slice(0, 8);
  if (topFixes.length) {
    lines.push("");
    lines.push("-".repeat(72));
    lines.push("TOP FIXES (site-wide, most pages first):");
    for (const f of topFixes) {
      const tag = f.fixableByAgent ? "" : " (flag only)";
      lines.push(`  ${String(f.affectedCount).padStart(3)} pages  ${f.id}${tag} [${f.scope}]`);
    }
  }

  // 5) The weakest pages only (not all of them) — full per-page list stays in the page index.
  const ranked = [...site.pageIndex].filter((p) => !p.blocked).sort((a, b) => a.overall - b.overall);
  const blocked = site.pageIndex.filter((p) => p.blocked);
  const weakest = ranked.slice(0, 8);
  if (weakest.length) {
    lines.push("");
    lines.push("-".repeat(72));
    lines.push(`WEAKEST PAGES (${weakest.length} of ${ranked.length} shown; full list in --json):`);
    for (const p of weakest) {
      lines.push(`  ${String(p.overall).padStart(3)}  ${p.pageType.padEnd(13)} ${p.finalUrl}`);
    }
  }
  if (blocked.length) {
    lines.push(`  ${blocked.length} page(s) could not be read (scored inconclusive, not failed).`);
  }

  if (site.advisories.length) {
    lines.push("");
    lines.push("Advisory (not scored — needs more than a static read):");
    for (const a of site.advisories) lines.push(`  ~ [${a.status}] ${a.label}`);
  }
  lines.push("=".repeat(72));
  return lines.join("\n");
}
