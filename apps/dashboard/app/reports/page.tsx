"use client"

import * as React from "react"
import Link from "next/link"
import { Link2, Loader2, RefreshCw } from "lucide-react"
import { ReportGenerationCard } from "@/components/reports/report-generation-card"
import { ReportList } from "@/components/reports/report-list"
import { ReportPreview } from "@/components/reports/report-preview"
import { DashboardShell } from "@/components/dashboard-shell"
import { StatePanel } from "@/components/state-panel"
import { Button } from "@/components/ui/button"
import { loginWithGithub, useUser } from "@/hooks/use-auth"
import {
  useCreateReportShareLink,
  useGenerateReports,
  useReport,
  useReports,
  useRevokeReportShareLink,
} from "@/hooks/use-reports"

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
          description={reports.error.message}
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
          <ReportGenerationCard
            error={generate.error ?? null}
            isPending={generate.isPending}
            notice={notice}
            onGenerate={() => generate.mutate()}
          />

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
              <ReportList
                onSelect={setExplicitSelectedId}
                reports={reportList}
                selectedId={selectedId}
              />

              <ReportPreview
                createShareError={createShare.error ?? null}
                createSharePending={createShare.isPending}
                error={detail.error ?? null}
                isError={detail.isError}
                isLoading={detail.isLoading}
                onCopyShareLink={copyShareLink}
                onRevokeShareLink={revokeShareLink}
                report={detail.data ?? null}
                revokeShareError={revokeShare.error ?? null}
                revokeSharePending={revokeShare.isPending}
              />
            </section>
          )}
        </section>
      ) : null}
    </DashboardShell>
  )
}
