import { randomBytes } from "node:crypto";

import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import type { SiteReport } from "@repo/types/scraper";
import type {
  ProjectReportContent,
  ProjectReportDetail,
  ProjectReportSummary,
  ReportMetric,
  ReportSection,
} from "@repo/types/reports";

type ReportRow = Prisma.ProjectReportGetPayload<{
  include: {
    shareLinks: {
      select: {
        token: true;
        expiresAt: true;
        revokedAt: true;
      };
    };
  };
}>;

export class ReportError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ReportError";
  }
}

function activeShareToken(report: ReportRow): string | null {
  const now = Date.now();
  const share = report.shareLinks.find((link) => {
    if (link.revokedAt) return false;
    if (!link.expiresAt) return true;
    return link.expiresAt.getTime() > now;
  });

  return share?.token ?? null;
}

function reportDownloadPath(reportId: string): string {
  return `/api/reports/${encodeURIComponent(reportId)}/download`;
}

function toSummary(
  report: ReportRow,
  shareUrlForToken: (token: string) => string | null = () => null,
): ProjectReportSummary {
  const token = activeShareToken(report);

  return {
    id: report.id,
    type: report.type,
    status: report.status,
    title: report.title,
    summary: report.summary,
    website: report.website,
    repoFullName: report.repoFullName,
    sourceKey: report.sourceKey,
    generatedAt: report.generatedAt.toISOString(),
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    downloadUrl: reportDownloadPath(report.id),
    activeShareUrl: token ? shareUrlForToken(token) : null,
  };
}

function toContent(value: Prisma.JsonValue): ProjectReportContent {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "formatVersion" in value &&
    "sections" in value
  ) {
    return value as unknown as ProjectReportContent;
  }

  return {
    formatVersion: 1,
    generatedFrom: "Unknown source",
    metrics: [],
    sections: [
      {
        heading: "Report unavailable",
        body: "The stored report content could not be read.",
        items: [],
      },
    ],
    links: [],
  };
}

function toDetail(
  report: ReportRow,
  shareUrlForToken: (token: string) => string | null = () => null,
): ProjectReportDetail {
  return {
    ...toSummary(report, shareUrlForToken),
    content: toContent(report.content),
  };
}

function reportInclude() {
  return {
    shareLinks: {
      orderBy: { createdAt: "desc" as const },
      select: {
        token: true,
        expiresAt: true,
        revokedAt: true,
      },
    },
  };
}

function siteReportFromJson(value: Prisma.JsonValue | null): SiteReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  if (!("overall" in value) || !("findings" in value)) {
    return null;
  }

  return value as unknown as SiteReport;
}

function scanContent(report: {
  website: string;
  reportData: Prisma.JsonValue | null;
  totalCheckupCount: number;
  updatedAt: Date;
}): ProjectReportContent {
  const data = siteReportFromJson(report.reportData);
  const findings = data?.findings ?? [];
  const crawl = data?.crawl;
  const summaryBad = data?.summary?.bad ?? [];
  const actionable = findings.filter(
    (finding) =>
      finding.fixableByAgent &&
      ["fail", "partial", "mixed"].includes(finding.siteStatus),
  );
  const topFindings = actionable
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6);

  const metrics: ReportMetric[] = [
    {
      label: "Score",
      value: data ? `${Math.round(data.overall)}/100` : "Pending",
      detail: data ? "Stored scan score" : "Scan data is not available yet",
    },
    {
      label: "Pages checked",
      value: String(crawl?.pagesChecked ?? 0),
      detail: data
        ? `${crawl?.totalDiscovered ?? 0} pages discovered`
        : "No crawl data stored",
    },
    {
      label: "Actionable issues",
      value: String(actionable.length),
      detail: "Fixable findings from the stored scan",
    },
  ];

  const sections: ReportSection[] = [
    {
      heading: "Executive summary",
      body: data
        ? `${report.website} scored ${Math.round(data.overall)}/100 across ${crawl?.pagesChecked ?? 0} checked pages.`
        : `${report.website} has a stored scan shell, but the full scan payload is not available yet.`,
      items: summaryBad.slice(0, 6),
    },
    {
      heading: "Top actionable fixes",
      body:
        topFindings.length > 0
          ? "These are the highest-weight fixable findings from the scan."
          : "No fixable findings were found in the stored scan payload.",
      items: topFindings.map(
        (finding) =>
          `${finding.id}: ${finding.category}, ${finding.affectedCount} affected page${finding.affectedCount === 1 ? "" : "s"}`,
      ),
    },
  ];

  return {
    formatVersion: 1,
    generatedFrom: `Stored scan updated ${report.updatedAt.toISOString()}`,
    metrics,
    sections,
    links: [{ label: "Website", url: report.website }],
  };
}

function fixSummaryContent(run: {
  id: string;
  website: string;
  state: string;
  branch: string | null;
  prUrl: string | null;
  prNumber: number | null;
  totalChecks: number;
  fixedChecks: number;
  pendingChecks: number;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  sandboxSeconds: number | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  repository: { fullName: string };
  checks: Array<{
    rubricId: string;
    category: string;
    status: string;
    fixed: boolean;
    note: string | null;
  }>;
}): ProjectReportContent {
  const fixed = run.checks.filter((check) => check.fixed);
  const unresolved = run.checks.filter((check) => !check.fixed).slice(0, 8);
  const metrics: ReportMetric[] = [
    {
      label: "Run state",
      value: run.state.toLowerCase().replaceAll("_", " "),
      detail: run.error,
    },
    {
      label: "Checks fixed",
      value: `${run.fixedChecks}/${run.totalChecks}`,
      detail: `${run.pendingChecks} pending`,
    },
    {
      label: "Sandbox time",
      value: run.sandboxSeconds ? `${run.sandboxSeconds}s` : "Not recorded",
      detail: run.model,
    },
    {
      label: "Tokens",
      value:
        run.tokensIn || run.tokensOut
          ? `${run.tokensIn ?? 0} in, ${run.tokensOut ?? 0} out`
          : "Not recorded",
      detail: "Model usage captured by the run",
    },
  ];

  return {
    formatVersion: 1,
    generatedFrom: `Fix run ${run.id}`,
    metrics,
    sections: [
      {
        heading: "Fix summary",
        body: `${run.repository.fullName} was processed for ${run.website}.`,
        items: [
          run.branch ? `Branch: ${run.branch}` : "Branch is not recorded yet",
          run.prNumber
            ? `Pull request: #${run.prNumber}`
            : "Pull request is not open yet",
          `Last updated: ${run.updatedAt.toISOString()}`,
        ],
      },
      {
        heading: "Fixed checks",
        body:
          fixed.length > 0
            ? "Checks marked fixed by the run."
            : "No checks are marked fixed yet.",
        items: fixed
          .slice(0, 10)
          .map((check) =>
            [check.rubricId, check.category, check.note]
              .filter(Boolean)
              .join(": "),
          ),
      },
      {
        heading: "Open checks",
        body:
          unresolved.length > 0
            ? "Checks still pending, skipped, flagged, or failed."
            : "No unresolved checks are recorded.",
        items: unresolved.map((check) =>
          [check.rubricId, check.status.toLowerCase(), check.note]
            .filter(Boolean)
            .join(": "),
        ),
      },
    ],
    links: [
      { label: "Website", url: run.website },
      ...(run.prUrl ? [{ label: "Pull request", url: run.prUrl }] : []),
    ],
  };
}

function beforeAfterDraftContent(run: {
  id: string;
  website: string;
  state: string;
  prUrl: string | null;
  repository: { fullName: string };
}): ProjectReportContent {
  return {
    formatVersion: 1,
    generatedFrom: `Fix run ${run.id}`,
    metrics: [
      {
        label: "Status",
        value: run.prUrl ? "Ready for re-check" : "Waiting for PR",
        detail: run.state.toLowerCase().replaceAll("_", " "),
      },
    ],
    sections: [
      {
        heading: "Before and after report",
        body: "This artifact is reserved for the post-fix re-check. It becomes ready after the fixed site is re-scanned and compared against the original scan.",
        items: [
          `Website: ${run.website}`,
          `Repository: ${run.repository.fullName}`,
          run.prUrl
            ? `Pull request: ${run.prUrl}`
            : "Pull request is not available yet",
        ],
      },
    ],
    links: [
      { label: "Website", url: run.website },
      ...(run.prUrl ? [{ label: "Pull request", url: run.prUrl }] : []),
    ],
  };
}

async function upsertScanReports(userId: string) {
  const checkupReports = await prisma.checkupReport.findMany({
    where: {
      orders: { some: { userId } },
    },
    orderBy: { updatedAt: "desc" },
  });

  await Promise.all(
    checkupReports.map((report) =>
      prisma.projectReport.upsert({
        where: { sourceKey: `scan:${report.id}` },
        create: {
          userId,
          type: "SCAN",
          status: "READY",
          title: "Scan report",
          summary: `Stored website scan for ${report.website}.`,
          content: scanContent(report) as unknown as Prisma.InputJsonValue,
          sourceKey: `scan:${report.id}`,
          website: report.website,
          checkupReportId: report.id,
          generatedAt: new Date(),
        },
        update: {
          status: "READY",
          title: "Scan report",
          summary: `Stored website scan for ${report.website}.`,
          content: scanContent(report) as unknown as Prisma.InputJsonValue,
          website: report.website,
          generatedAt: new Date(),
        },
      }),
    ),
  );
}

async function upsertFixReports(userId: string) {
  const runs = await prisma.fixRun.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      repository: { select: { fullName: true } },
      checks: {
        orderBy: [{ fixed: "desc" }, { weight: "desc" }],
        select: {
          rubricId: true,
          category: true,
          status: true,
          fixed: true,
          note: true,
        },
      },
    },
  });

  await Promise.all(
    runs.flatMap((run) => [
      prisma.projectReport.upsert({
        where: { sourceKey: `fix:${run.id}` },
        create: {
          userId,
          type: "FIX_SUMMARY",
          status: run.state === "FAILED" ? "FAILED" : "READY",
          title: "Fix summary",
          summary: `${run.fixedChecks}/${run.totalChecks} checks fixed for ${run.website}.`,
          content: fixSummaryContent(run) as unknown as Prisma.InputJsonValue,
          sourceKey: `fix:${run.id}`,
          website: run.website,
          repoFullName: run.repository.fullName,
          fixRunId: run.id,
          generatedAt: new Date(),
        },
        update: {
          status: run.state === "FAILED" ? "FAILED" : "READY",
          summary: `${run.fixedChecks}/${run.totalChecks} checks fixed for ${run.website}.`,
          content: fixSummaryContent(run) as unknown as Prisma.InputJsonValue,
          website: run.website,
          repoFullName: run.repository.fullName,
          generatedAt: new Date(),
        },
      }),
      prisma.projectReport.upsert({
        where: { sourceKey: `before-after:${run.id}` },
        create: {
          userId,
          type: "BEFORE_AFTER",
          status: "DRAFT",
          title: "Before and after",
          summary: "Waiting for the post-fix re-check comparison.",
          content: beforeAfterDraftContent(
            run,
          ) as unknown as Prisma.InputJsonValue,
          sourceKey: `before-after:${run.id}`,
          website: run.website,
          repoFullName: run.repository.fullName,
          fixRunId: run.id,
          generatedAt: new Date(),
        },
        update: {
          status: "DRAFT",
          content: beforeAfterDraftContent(
            run,
          ) as unknown as Prisma.InputJsonValue,
          website: run.website,
          repoFullName: run.repository.fullName,
          generatedAt: new Date(),
        },
      }),
    ]),
  );
}

export async function generateReportsForUser(
  userId: string,
  shareUrlForToken?: (token: string) => string | null,
): Promise<ProjectReportSummary[]> {
  await upsertScanReports(userId);
  await upsertFixReports(userId);
  return listReportsForUser(userId, shareUrlForToken);
}

export async function listReportsForUser(
  userId: string,
  shareUrlForToken?: (token: string) => string | null,
): Promise<ProjectReportSummary[]> {
  const reports = await prisma.projectReport.findMany({
    where: { userId },
    orderBy: { generatedAt: "desc" },
    include: reportInclude(),
  });

  return reports.map((report) => toSummary(report, shareUrlForToken));
}

export async function getReportForUser(
  userId: string,
  reportId: string,
  shareUrlForToken?: (token: string) => string | null,
): Promise<ProjectReportDetail | null> {
  const report = await prisma.projectReport.findFirst({
    where: { id: reportId, userId },
    include: reportInclude(),
  });

  return report ? toDetail(report, shareUrlForToken) : null;
}

export async function getSharedReport(
  token: string,
): Promise<ProjectReportDetail | null> {
  const share = await prisma.reportShareLink.findUnique({
    where: { token },
    include: {
      report: {
        include: reportInclude(),
      },
    },
  });

  if (!share || share.revokedAt) return null;
  if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) return null;

  return toDetail(share.report, () => null);
}

export async function createReportShareLink(input: {
  userId: string;
  reportId: string;
  shareUrlForToken: (token: string) => string;
}) {
  const report = await prisma.projectReport.findFirst({
    where: { id: input.reportId, userId: input.userId },
    include: reportInclude(),
  });

  if (!report) {
    throw new ReportError(404, "Report not found.");
  }

  const existingToken = activeShareToken(report);
  if (existingToken) {
    return {
      token: existingToken,
      shareUrl: input.shareUrlForToken(existingToken),
      expiresAt:
        report.shareLinks
          .find((link) => link.token === existingToken)
          ?.expiresAt?.toISOString() ?? null,
    };
  }

  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const share = await prisma.reportShareLink.create({
    data: {
      reportId: input.reportId,
      userId: input.userId,
      token: randomBytes(18).toString("base64url"),
      expiresAt,
    },
  });

  return {
    token: share.token,
    shareUrl: input.shareUrlForToken(share.token),
    expiresAt: share.expiresAt?.toISOString() ?? null,
  };
}

export async function revokeReportShareLink(input: {
  userId: string;
  reportId: string;
}): Promise<void> {
  const report = await prisma.projectReport.findFirst({
    where: { id: input.reportId, userId: input.userId },
    select: { id: true },
  });

  if (!report) {
    throw new ReportError(404, "Report not found.");
  }

  await prisma.reportShareLink.updateMany({
    where: {
      reportId: input.reportId,
      userId: input.userId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function reportTypeLabel(type: ProjectReportDetail["type"]): string {
  if (type === "SCAN") return "AI Search readiness report";
  if (type === "FIX_SUMMARY") return "Fix summary report";
  if (type === "BEFORE_AFTER") return "Before and after report";
  return "Client report export";
}

function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hostLabel(value: string | null): string {
  if (!value) return "Not specified";

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function renderLogoSvg(): string {
  return `<svg class="brand-mark" aria-hidden="true" fill="currentColor" viewBox="0 0 491 492" xmlns="http://www.w3.org/2000/svg">
    <path d="M233.46 0.529372C275.545 -2.73113 323.87 9.34336 360.745 29.2084C419.08 60.4394 462.355 113.872 480.79 177.421L424.85 177.542C418.555 160.775 409.91 144.99 399.165 130.661C365.91 86.4364 320.79 62.1964 266.64 54.4749L266.795 138.564C252.525 138.666 238.055 138.49 223.766 138.433L223.822 54.6314C189.536 57.2304 151.586 74.5309 125 95.9164C85.2106 127.702 59.7936 174.087 54.4156 224.728C81.9791 224.223 110.34 224.47 137.937 224.437L137.94 267.406L54.2286 267.316C65.8211 358.541 132.76 424.881 223.795 437.076L223.782 353.321H266.79L266.765 437.096C268.675 436.896 270.86 436.521 272.785 436.241C304.38 431.946 337.225 417.671 362.235 398.151C405.5 364.381 429.345 321.231 436.445 267.356L352.64 267.331L352.695 224.376L489.785 224.37C490.535 240.131 491.12 249.541 489.925 265.491C485.775 318.551 464.34 368.791 428.91 408.506C385.72 457.441 324.775 487.106 259.62 490.911C194.748 494.836 131.002 472.666 82.5646 429.336C33.7881 386.286 4.24058 325.531 0.496577 260.581C-3.70242 194.912 18.8636 130.342 63.0521 81.5854C107.272 32.0369 167.477 4.35937 233.46 0.529372Z" />
    <path d="M241.291 200.017C266.621 197.857 288.906 216.642 291.061 241.97C293.216 267.3 274.426 289.585 249.096 291.735C223.772 293.89 201.496 275.105 199.34 249.78C197.185 224.455 215.965 202.176 241.291 200.017Z" />
  </svg>`;
}

export function renderReportHtml(report: ProjectReportDetail): string {
  const metrics = report.content.metrics
    .map(
      (metric) => `
        <section class="metric">
          <p>${escapeHtml(metric.label)}</p>
          <strong>${escapeHtml(metric.value)}</strong>
          ${
            metric.detail
              ? `<span>${escapeHtml(metric.detail)}</span>`
              : "<span>No extra detail recorded</span>"
          }
        </section>`,
    )
    .join("");

  const sections = report.content.sections
    .map(
      (section, index) => `
        <section class="section-block">
          <div class="section-kicker">Section ${index + 1}</div>
          <h2>${escapeHtml(section.heading)}</h2>
          <p>${escapeHtml(section.body)}</p>
          ${
            section.items.length > 0
              ? `<ul>${section.items
                  .map((item) => `<li>${escapeHtml(item)}</li>`)
                  .join("")}</ul>`
              : '<div class="empty-note">No line items recorded for this section.</div>'
          }
        </section>`,
    )
    .join("");

  const links = report.content.links
    .map((link) => {
      const href = safeExternalUrl(link.url);
      if (!href) return "";

      return `<a href="${escapeHtml(href)}">${escapeHtml(link.label)}</a>`;
    })
    .filter(Boolean)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.title)} | GEO Repair</title>
    <style>
      :root {
        color-scheme: light;
        --paper: #ffffff;
        --ink: #171717;
        --muted: #5f6362;
        --line: #d8dedb;
        --soft: #f5f7f6;
        --brand: #16825d;
        --brand-soft: #eaf6f0;
        --warning: #8a5b12;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      @page {
        size: A4;
        margin: 18mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #eef2f0;
        color: var(--ink);
      }

      .page {
        width: min(1040px, calc(100vw - 32px));
        margin: 32px auto;
        background: var(--paper);
        border: 1px solid var(--line);
      }

      header {
        padding: 40px;
        border-bottom: 1px solid var(--line);
        background: linear-gradient(180deg, #ffffff 0%, #f7faf8 100%);
      }

      .brand-row,
      .meta-grid,
      .metrics,
      .trust-grid,
      footer {
        display: grid;
        gap: 16px;
      }

      .brand-row {
        grid-template-columns: 1fr auto;
        align-items: start;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-weight: 700;
      }

      .brand-mark {
        width: 28px;
        height: 28px;
        color: var(--brand);
      }

      .eyebrow,
      .section-kicker,
      .meta span,
      .metric p {
        margin: 0;
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .status {
        border: 1px solid var(--line);
        padding: 8px 10px;
        color: var(--brand);
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }

      h1 {
        max-width: 780px;
        margin: 32px 0 12px;
        font-size: 44px;
        line-height: 1.04;
      }

      .summary {
        max-width: 760px;
        margin: 0;
        color: var(--muted);
        font-size: 17px;
        line-height: 1.65;
      }

      .meta-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        margin-top: 32px;
      }

      .meta,
      .metric,
      .trust {
        border: 1px solid var(--line);
        background: var(--soft);
        padding: 16px;
      }

      .meta strong,
      .metric strong {
        display: block;
        margin-top: 8px;
        overflow-wrap: anywhere;
      }

      main {
        padding: 32px 40px 40px;
      }

      .metrics {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .metric strong {
        color: var(--brand);
        font-size: 28px;
        line-height: 1;
      }

      .metric span,
      .empty-note {
        display: block;
        margin-top: 10px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }

      .section-block {
        margin-top: 28px;
        padding-top: 28px;
        border-top: 1px solid var(--line);
      }

      h2 {
        margin: 8px 0 8px;
        font-size: 24px;
        line-height: 1.2;
      }

      .section-block p {
        max-width: 780px;
        margin: 0;
        color: var(--muted);
        line-height: 1.65;
      }

      ul {
        display: grid;
        gap: 10px;
        margin: 18px 0 0;
        padding: 0;
        list-style: none;
      }

      li {
        border-left: 4px solid var(--brand);
        background: var(--soft);
        padding: 12px 14px;
        line-height: 1.5;
      }

      .links {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 22px;
      }

      .links a {
        border: 1px solid var(--line);
        color: var(--brand);
        padding: 10px 12px;
        text-decoration: none;
        font-weight: 700;
      }

      .trust-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin-top: 32px;
      }

      .trust h3 {
        margin: 0 0 8px;
        font-size: 15px;
      }

      .trust p {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.55;
      }

      footer {
        grid-template-columns: 1fr auto;
        padding: 24px 40px;
        border-top: 1px solid var(--line);
        color: var(--muted);
        font-size: 12px;
      }

      @media (max-width: 760px) {
        .page {
          width: 100%;
          margin: 0;
          border-left: 0;
          border-right: 0;
        }

        header,
        main,
        footer {
          padding-left: 20px;
          padding-right: 20px;
        }

        .brand-row,
        .meta-grid,
        .metrics,
        .trust-grid,
        footer {
          grid-template-columns: 1fr;
        }

        h1 {
          font-size: 32px;
        }
      }

      @media print {
        body {
          background: #fff;
        }

        .page {
          width: auto;
          margin: 0;
          border: 0;
        }

        a {
          color: var(--ink);
        }
      }
    </style>
  </head>
  <body>
    <article class="page">
      <header>
        <div class="brand-row">
          <div class="brand">${renderLogoSvg()} GEO Repair</div>
          <div class="status">${escapeHtml(report.status.toLowerCase())}</div>
        </div>
        <p class="eyebrow">${escapeHtml(reportTypeLabel(report.type))}</p>
        <h1>${escapeHtml(report.title)}</h1>
        <p class="summary">${escapeHtml(report.summary)}</p>
        <div class="meta-grid">
          <div class="meta"><span>Website</span><strong>${escapeHtml(hostLabel(report.website))}</strong></div>
          <div class="meta"><span>Repository</span><strong>${escapeHtml(report.repoFullName ?? "Not specified")}</strong></div>
          <div class="meta"><span>Generated</span><strong>${escapeHtml(formatReportDate(report.generatedAt))}</strong></div>
          <div class="meta"><span>Source</span><strong>${escapeHtml(report.content.generatedFrom)}</strong></div>
        </div>
      </header>
      <main>
        <section class="metrics">${metrics}</section>
        ${sections}
        ${links ? `<nav class="links" aria-label="Report links">${links}</nav>` : ""}
        <section class="trust-grid">
          <div class="trust">
            <h3>What this report means</h3>
            <p>This measures technical AI Search readiness from stored scan, run, and PR data. It does not promise rankings, traffic, or citations.</p>
          </div>
          <div class="trust">
            <h3>What is kept private</h3>
            <p>Reports avoid raw source code, secrets, full terminal logs, and private repository file contents.</p>
          </div>
        </section>
      </main>
      <footer>
        <span>Prepared by GEO Repair for ${escapeHtml(hostLabel(report.website))}</span>
        <span>${escapeHtml(report.id)}</span>
      </footer>
    </article>
  </body>
</html>`;
}

export function reportDownloadFilename(report: ProjectReportDetail): string {
  const base = report.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "report"}-${report.id}.html`;
}
