import type { Request, Response } from "express";

import Secrets from "@repo/secrets/backend";
import {
  ReportError,
  createReportShareLink,
  generateReportsForUser,
  getReportForUser,
  getSharedReport,
  listReportsForUser,
  renderReportMarkdown,
  reportDownloadFilename,
  revokeReportShareLink,
} from "./report.service";

function sendReportError(res: Response, err: unknown): Response {
  if (err instanceof ReportError) {
    return res.status(err.status).json({ error: err.message });
  }

  throw err;
}

function requestOrigin(req: Request): string {
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get("host") || "localhost:4000";
  return `${protocol}://${host}`;
}

function shareUrlForRequest(req: Request) {
  const origin = (
    req.get("origin") ||
    Secrets.DASHBOARD_URL ||
    Secrets.FRONTEND_URL ||
    requestOrigin(req)
  ).replace(/\/+$/, "");
  return (token: string) =>
    `${origin}/reports/share/${encodeURIComponent(token)}`;
}

function stringParam(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function listReports(req: Request, res: Response) {
  try {
    const reports = await listReportsForUser(
      req.userId!,
      shareUrlForRequest(req),
    );
    return res.json({ reports });
  } catch (err) {
    return sendReportError(res, err);
  }
}

export async function generateReports(req: Request, res: Response) {
  try {
    const reports = await generateReportsForUser(
      req.userId!,
      shareUrlForRequest(req),
    );
    return res.status(201).json({ reports });
  } catch (err) {
    return sendReportError(res, err);
  }
}

export async function getReport(req: Request, res: Response) {
  try {
    const reportId = stringParam(req.params.reportId);
    if (!reportId) {
      return res.status(400).json({ error: "reportId is required." });
    }

    const report = await getReportForUser(
      req.userId!,
      reportId,
      shareUrlForRequest(req),
    );
    if (!report) {
      return res.status(404).json({ error: "Report not found." });
    }

    return res.json({ report });
  } catch (err) {
    return sendReportError(res, err);
  }
}

export async function downloadReport(req: Request, res: Response) {
  try {
    const reportId = stringParam(req.params.reportId);
    if (!reportId) {
      return res.status(400).json({ error: "reportId is required." });
    }

    const report = await getReportForUser(
      req.userId!,
      reportId,
      shareUrlForRequest(req),
    );
    if (!report) {
      return res.status(404).json({ error: "Report not found." });
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportDownloadFilename(report)}"`,
    );
    return res.send(renderReportMarkdown(report));
  } catch (err) {
    return sendReportError(res, err);
  }
}

export async function createShareLink(req: Request, res: Response) {
  try {
    const reportId = stringParam(req.params.reportId);
    if (!reportId) {
      return res.status(400).json({ error: "reportId is required." });
    }

    const share = await createReportShareLink({
      userId: req.userId!,
      reportId,
      shareUrlForToken: shareUrlForRequest(req),
    });

    return res.status(201).json({ share });
  } catch (err) {
    return sendReportError(res, err);
  }
}

export async function revokeShareLink(req: Request, res: Response) {
  try {
    const reportId = stringParam(req.params.reportId);
    if (!reportId) {
      return res.status(400).json({ error: "reportId is required." });
    }

    await revokeReportShareLink({ userId: req.userId!, reportId });
    return res.status(204).send();
  } catch (err) {
    return sendReportError(res, err);
  }
}

export async function getPublicSharedReport(req: Request, res: Response) {
  try {
    const token = stringParam(req.params.token);
    if (!token) {
      return res.status(400).json({ error: "token is required." });
    }

    const report = await getSharedReport(token);
    if (!report) {
      return res.status(404).json({ error: "Shared report not found." });
    }

    return res.json({ report });
  } catch (err) {
    return sendReportError(res, err);
  }
}

export async function downloadPublicSharedReport(req: Request, res: Response) {
  try {
    const token = stringParam(req.params.token);
    if (!token) {
      return res.status(400).json({ error: "token is required." });
    }

    const report = await getSharedReport(token);
    if (!report) {
      return res.status(404).json({ error: "Shared report not found." });
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportDownloadFilename(report)}"`,
    );
    return res.send(renderReportMarkdown(report));
  } catch (err) {
    return sendReportError(res, err);
  }
}
