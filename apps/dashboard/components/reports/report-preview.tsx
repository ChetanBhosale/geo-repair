"use client"

import {
  Clipboard,
  Download,
  Eye,
  Loader2,
  Share2,
  X,
} from "lucide-react"
import type { ProjectReportDetail } from "@repo/types/reports"
import { reportStatusVariant } from "@/lib/dashboard-format"
import { ENDPOINTS } from "@/lib/endpoint"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StatePanel } from "@/components/state-panel"

export function ReportPreview({
  createShareError,
  createSharePending,
  error,
  isError,
  isLoading,
  onCopyShareLink,
  onRevokeShareLink,
  report,
  revokeShareError,
  revokeSharePending,
}: {
  createShareError: Error | null
  createSharePending: boolean
  error: Error | null
  isError: boolean
  isLoading: boolean
  onCopyShareLink: (reportId: string) => void
  onRevokeShareLink: (reportId: string) => void
  report: ProjectReportDetail | null
  revokeShareError: Error | null
  revokeSharePending: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{report?.title ?? "Report preview"}</CardTitle>
            <CardDescription>
              {report?.summary ?? "Select a report to inspect the stored artifact."}
            </CardDescription>
          </div>
          {report ? (
            <Badge variant={reportStatusVariant(report.status)}>
              {report.status.toLowerCase()}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading report detail
          </p>
        ) : null}

        {isError ? (
          <StatePanel
            eyebrow="Preview error"
            title="Could not load this report"
            description={
              error?.message ?? "The selected report detail could not be loaded."
            }
            tone="danger"
          />
        ) : null}

        {report ? (
          <ReportDetail
            createShareError={createShareError}
            createSharePending={createSharePending}
            onCopyShareLink={onCopyShareLink}
            onRevokeShareLink={onRevokeShareLink}
            report={report}
            revokeShareError={revokeShareError}
            revokeSharePending={revokeSharePending}
          />
        ) : (
          <StatePanel
            eyebrow="No selection"
            title="Select a stored report"
            description="The preview will show the stored content, metrics, sections, links, and export actions."
          />
        )}
      </CardContent>
    </Card>
  )
}

function ReportDetail({
  createShareError,
  createSharePending,
  onCopyShareLink,
  onRevokeShareLink,
  report,
  revokeShareError,
  revokeSharePending,
}: {
  createShareError: Error | null
  createSharePending: boolean
  onCopyShareLink: (reportId: string) => void
  onRevokeShareLink: (reportId: string) => void
  report: ProjectReportDetail
  revokeShareError: Error | null
  revokeSharePending: boolean
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {report.content.metrics.map((metric) => (
          <Metric
            detail={metric.detail}
            key={metric.label}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </div>

      <div className="grid gap-3">
        {report.content.sections.map((section) => (
          <section
            className="rounded-lg border border-border bg-background p-4"
            key={section.heading}
          >
            <h3 className="text-sm font-semibold">{section.heading}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{section.body}</p>
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

      <ReportActions
        createSharePending={createSharePending}
        onCopyShareLink={onCopyShareLink}
        onRevokeShareLink={onRevokeShareLink}
        report={report}
        revokeSharePending={revokeSharePending}
      />
      {createShareError || revokeShareError ? (
        <p className="text-sm text-destructive">
          {(createShareError ?? revokeShareError)?.message}
        </p>
      ) : null}
    </>
  )
}

function ReportActions({
  createSharePending,
  onCopyShareLink,
  onRevokeShareLink,
  report,
  revokeSharePending,
}: {
  createSharePending: boolean
  onCopyShareLink: (reportId: string) => void
  onRevokeShareLink: (reportId: string) => void
  report: ProjectReportDetail
  revokeSharePending: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <a href={ENDPOINTS.reportDownload(report.id)}>
          <Download className="size-4" />
          Download
        </a>
      </Button>
      {report.activeShareUrl ? (
        <>
          <Button asChild variant="outline">
            <a href={report.activeShareUrl} rel="noreferrer" target="_blank">
              <Eye className="size-4" />
              Open share
            </a>
          </Button>
          <Button
            disabled={createSharePending}
            onClick={() => onCopyShareLink(report.id)}
            variant="outline"
          >
            <Clipboard className="size-4" />
            Copy link
          </Button>
          <Button
            disabled={revokeSharePending}
            onClick={() => onRevokeShareLink(report.id)}
            variant="outline"
          >
            <X className="size-4" />
            Revoke
          </Button>
        </>
      ) : (
        <Button
          disabled={createSharePending}
          onClick={() => onCopyShareLink(report.id)}
          variant="outline"
        >
          {createSharePending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Share2 className="size-4" />
          )}
          Create share link
        </Button>
      )}
    </div>
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
