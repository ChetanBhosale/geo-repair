export type ProjectReportType =
  | "SCAN"
  | "FIX_SUMMARY"
  | "BEFORE_AFTER"
  | "EXPORT";

export type ProjectReportStatus = "READY" | "DRAFT" | "FAILED";

export interface ReportMetric {
  label: string;
  value: string;
  detail: string | null;
}

export interface ReportSection {
  heading: string;
  body: string;
  items: string[];
}

export interface ReportLink {
  label: string;
  url: string;
}

export interface ProjectReportContent {
  formatVersion: 1;
  generatedFrom: string;
  metrics: ReportMetric[];
  sections: ReportSection[];
  links: ReportLink[];
}

export interface ProjectReportSummary {
  id: string;
  type: ProjectReportType;
  status: ProjectReportStatus;
  title: string;
  summary: string;
  website: string | null;
  repoFullName: string | null;
  sourceKey: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
  activeShareUrl: string | null;
}

export interface ProjectReportDetail extends ProjectReportSummary {
  content: ProjectReportContent;
}

export interface ListReportsResponse {
  reports: ProjectReportSummary[];
}

export interface GenerateReportsResponse {
  reports: ProjectReportSummary[];
}

export interface ReportDetailResponse {
  report: ProjectReportDetail;
}

export interface ReportShareLink {
  token: string;
  shareUrl: string;
  expiresAt: string | null;
}

export interface ReportShareResponse {
  share: ReportShareLink;
}
