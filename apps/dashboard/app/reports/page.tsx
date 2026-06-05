"use client"

import * as React from "react"
import Link from "next/link"
import {
  Clipboard,
  Download,
  Eye,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  Share2,
  X,
} from "lucide-react"
import type { ProjectReportSummary } from "@repo/types/reports"
import { loginWithGithub, useUser } from "@/hooks/use-auth"
import {
  useCreateReportShareLink,
  useGenerateReports,
  useReport,
  useReports,
  useRevokeReportShareLink,
} from "@/hooks/use-reports"
import { DashboardShell } from "@/components/dashboard-shell"
import { StatePanel } from "@/components/state-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ENDPOINTS } from "@/lib/endpoint"

const TYPE_LABELS: Record<ProjectReportSummary["type"], string> = {
  SCAN: "Scan report",
  FIX_SUMMARY: "Fix summary",
  BEFORE_AFTER: "Before and after",
  EXPORT: "Export",
}

export default function ReportsPage() {
  const { isLoading, isSignedIn } = useUser()
  const reports = useReports(isSignedIn)
  const generate = useGenerateReports()
  const createShare = useCreateReportShareLink()
  const revokeShare = useRevokeReportShareLink()
  const [explicitSelectedId, setExplicitSelectedId] = React.useState<
    string | null
  >(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const reportList = reports.data ?? []
  const selectedId =
    explicitSelectedId &&
    reportList.some((report) => report.id === explicitSelectedId)
      ? explicitSelectedId
      : (reportList[0]?.id ?? null)

  const detail = useReport(selectedId, isSignedIn && !!selectedId)
  const selectedReport = detail.data

  async function copyShareLink(reportId: string) {
    const share = await createShare.mutateAsync(reportId)
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(share.shareUrl).catch(() => undefined)
    }
    setNotice("Share link copied")
  }

  async function revokeShareLink(reportId: string) {
    await revokeShare.mutateAsync(reportId)
    setNotice("Share link revoked")
  }

  return (
    <DashboardShell eyebrow="Reports" title="Project reports">
      {isLoading || reports.isLoading ? (
        <StatePanel
          eyebrow="Loading"
          title="Loading reports"
          description="We are checking stored scan, fix, and export artifacts."
          action={
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          }
        />
      ) : null}

      {!isLoading && !isSignedIn ? (
        <StatePanel
          eyebrow="GitHub required"
          title="Connect GitHub to view project reports"
          description="Reports are scoped to your authenticated account and selected project."
          action={
            <Button onClick={loginWithGithub}>
              <Link2 className="size-4" />
              Continue with GitHub
            </Button>
          }
        />
      ) : null}

      {isSignedIn && reports.isError ? (
        <StatePanel
          eyebrow="Report error"
          title="Could not load reports"
          description={(reports.error as Error).message}
          tone="danger"
          action={
            <Button onClick={() => reports.refetch()} variant="outline">
              <RefreshCw className="size-4" />
              Retry
            </Button>
          }
        />
      ) : null}

      {isSignedIn && !reports.isLoading ? (
        <section className="grid gap-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Report generation</CardTitle>
                  <CardDescription>
                    Generate stored report artifacts from scans, fix runs, and
                    PR outcomes.
                  </CardDescription>
                </div>
                <Button
                  disabled={generate.isPending}
                  onClick={() => generate.mutate()}
                >
                  {generate.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Generate reports
                </Button>
              </div>
            </CardHeader>
            {generate.isError || notice ? (
              <CardContent>
                {generate.isError ? (
                  <p className="text-sm text-destructive">
                    {(generate.error as Error).message}
                  </p>
                ) : null}
                {notice ? (
                  <p className="text-sm text-muted-foreground">{notice}</p>
                ) : null}
              </CardContent>
            ) : null}
          </Card>

          {reportList.length === 0 ? (
            <StatePanel
              eyebrow="No reports"
              title="Generate reports after a scan or fix run"
              description="Reports are stored after generation and can be viewed, downloaded, or shared from here."
              action={
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={generate.isPending}
                    onClick={() => generate.mutate()}
                  >
                    {generate.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    Generate reports
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/website-scan">Run website scan</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <section className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>Stored reports</CardTitle>
                  <CardDescription>
                    Select a report to view details, download it, or manage its
                    share link.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {reportList.map((report) => (
                    <ReportListItem
                      isSelected={report.id === selectedId}
                      key={report.id}
                      onSelect={() => setExplicitSelectedId(report.id)}
                      report={report}
                    />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>
                        {selectedReport?.title ?? "Report preview"}
                      </CardTitle>
                      <CardDescription>
                        {selectedReport?.summary ??
                          "Select a report to inspect the stored artifact."}
                      </CardDescription>
                    </div>
                    {selectedReport ? (
                      <Badge variant={badgeVariant(selectedReport.status)}>
                        {selectedReport.status.toLowerCase()}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {detail.isLoading ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading report detail
                    </p>
                  ) : null}

                  {detail.isError ? (
                    <StatePanel
                      eyebrow="Preview error"
                      title="Could not load this report"
                      description={(detail.error as Error).message}
                      tone="danger"
                    />
                  ) : null}

                  {selectedReport ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {selectedReport.content.metrics.map((metric) => (
                          <Metric
                            detail={metric.detail}
                            key={metric.label}
                            label={metric.label}
                            value={metric.value}
                          />
                        ))}
                      </div>

                      <div className="grid gap-3">
                        {selectedReport.content.sections.map((section) => (
                          <section
                            className="rounded-lg border border-border bg-background p-4"
                            key={section.heading}
                          >
                            <h3 className="text-sm font-semibold">
                              {section.heading}
                            </h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {section.body}
                            </p>
                            {section.items.length > 0 ? (
                              <ul className="mt-3 grid gap-2 text-sm">
                                {section.items.map((item) => (
                                  <li
                                    className="rounded-md border border-border bg-muted/25 px-3 py-2"
                                    key={item}
                                  >
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </section>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                          <a href={ENDPOINTS.reportDownload(selectedReport.id)}>
                            <Download className="size-4" />
                            Download
                          </a>
                        </Button>
                        {selectedReport.activeShareUrl ? (
                          <>
                            <Button asChild variant="outline">
                              <a
                                href={selectedReport.activeShareUrl}
                                rel="noreferrer"
                                target="_blank"
                              >
                                <Eye className="size-4" />
                                Open share
                              </a>
                            </Button>
                            <Button
                              disabled={createShare.isPending}
                              onClick={() => copyShareLink(selectedReport.id)}
                              variant="outline"
                            >
                              <Clipboard className="size-4" />
                              Copy link
                            </Button>
                            <Button
                              disabled={revokeShare.isPending}
                              onClick={() => revokeShareLink(selectedReport.id)}
                              variant="outline"
                            >
                              <X className="size-4" />
                              Revoke
                            </Button>
                          </>
                        ) : (
                          <Button
                            disabled={createShare.isPending}
                            onClick={() => copyShareLink(selectedReport.id)}
                            variant="outline"
                          >
                            {createShare.isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Share2 className="size-4" />
                            )}
                            Create share link
                          </Button>
                        )}
                      </div>
                      {createShare.isError || revokeShare.isError ? (
                        <p className="text-sm text-destructive">
                          {
                            ((createShare.error ?? revokeShare.error) as Error)
                              .message
                          }
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <StatePanel
                      eyebrow="No selection"
                      title="Select a stored report"
                      description="The preview will show the stored content, metrics, sections, links, and export actions."
                    />
                  )}
                </CardContent>
              </Card>
            </section>
          )}
        </section>
      ) : null}
    </DashboardShell>
  )
}

function ReportListItem({
  report,
  isSelected,
  onSelect,
}: {
  report: ProjectReportSummary
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      className={`rounded-lg border p-3 text-left transition-colors ${
        isSelected
          ? "border-foreground bg-muted/40"
          : "border-border bg-background hover:bg-muted/25"
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{report.title}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {TYPE_LABELS[report.type]} / {report.website ?? "No website"}
          </p>
        </div>
        <Badge variant={badgeVariant(report.status)}>
          {report.status.toLowerCase()}
        </Badge>
      </div>
      <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
        {report.summary}
      </p>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="size-3.5" />
        {new Date(report.generatedAt).toLocaleString()}
      </div>
    </button>
  )
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string | null
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/25 p-4">
      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium">{value}</p>
      {detail ? (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {detail}
        </p>
      ) : null}
    </div>
  )
}

function badgeVariant(status: ProjectReportSummary["status"]) {
  if (status === "READY") return "pass"
  if (status === "FAILED") return "fail"
  return "muted"
}
