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

export function renderReportMarkdown(report: ProjectReportDetail): string {
  const lines = [
    `# ${report.title}`,
    "",
    report.summary,
    "",
    `Website: ${report.website ?? "Not specified"}`,
    `Repository: ${report.repoFullName ?? "Not specified"}`,
    `Status: ${report.status.toLowerCase()}`,
    `Generated: ${report.generatedAt}`,
    "",
  ];

  if (report.content.metrics.length > 0) {
    lines.push("## Metrics", "");
    for (const metric of report.content.metrics) {
      lines.push(
        `- ${metric.label}: ${metric.value}${metric.detail ? ` (${metric.detail})` : ""}`,
      );
    }
    lines.push("");
  }

  for (const section of report.content.sections) {
    lines.push(`## ${section.heading}`, "", section.body, "");
    for (const item of section.items) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (report.content.links.length > 0) {
    lines.push("## Links", "");
    for (const link of report.content.links) {
      lines.push(`- [${link.label}](${link.url})`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

export function reportDownloadFilename(report: ProjectReportDetail): string {
  const base = report.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "report"}-${report.id}.md`;
}
