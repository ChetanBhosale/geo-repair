"use client"

import { Clipboard, Download, Eye, Loader2, Share2, X } from "lucide-react"
import type { ProjectReportDetail } from "@repo/types/reports"
import { ENDPOINTS } from "@/lib/endpoint"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatePanel } from "@/components/state-panel"
import { ProfessionalReport } from "@/components/reports/professional-report"

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
      <CardContent className="grid gap-4">
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-secondary">
            <Loader2 className="size-4 animate-spin" />
            Loading report detail
          </p>
        ) : null}

        {isError ? (
          <StatePanel
            eyebrow="Preview error"
            title="Could not load this report"
            description={
              error?.message ??
              "The selected report detail could not be loaded."
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
      <ProfessionalReport
        actions={
          <ReportActions
            createSharePending={createSharePending}
            onCopyShareLink={onCopyShareLink}
            onRevokeShareLink={onRevokeShareLink}
            report={report}
            revokeSharePending={revokeSharePending}
          />
        }
        report={report}
      />
      {createShareError || revokeShareError ? (
        <p className="text-sm text-danger">
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
    <div className="flex flex-wrap justify-end gap-2">
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
