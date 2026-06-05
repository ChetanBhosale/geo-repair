"use client"

import { FileText } from "lucide-react"
import type { ProjectReportSummary } from "@repo/types/reports"
import { formatDateTime, reportStatusVariant } from "@/lib/dashboard-format"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const TYPE_LABELS: Record<ProjectReportSummary["type"], string> = {
  SCAN: "Scan report",
  FIX_SUMMARY: "Fix summary",
  BEFORE_AFTER: "Before and after",
  EXPORT: "Export",
}

export function ReportList({
  onSelect,
  reports,
  selectedId,
}: {
  onSelect: (reportId: string) => void
  reports: ProjectReportSummary[]
  selectedId: string | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stored reports</CardTitle>
        <CardDescription>
          Select a report to view details, download it, or manage its share
          link.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {reports.map((report) => (
          <ReportListItem
            isSelected={report.id === selectedId}
            key={report.id}
            onSelect={() => onSelect(report.id)}
            report={report}
          />
        ))}
      </CardContent>
    </Card>
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
      className={`rounded-lg p-3 text-left transition-colors ${
        isSelected ? "bg-secondary/40" : "bg-primary hover:bg-secondary/25"
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{report.title}</p>
          <p className="mt-1 truncate text-xs text-secondary">
            {TYPE_LABELS[report.type]} / {report.website ?? "No website"}
          </p>
        </div>
        <Badge variant={reportStatusVariant(report.status)}>
          {report.status.toLowerCase()}
        </Badge>
      </div>
      <p className="mt-3 line-clamp-2 text-xs text-secondary">
        {report.summary}
      </p>
      <div className="mt-3 flex items-center gap-2 text-xs text-secondary">
        <FileText className="size-3.5" />
        {formatDateTime(report.generatedAt)}
      </div>
    </button>
  )
}
