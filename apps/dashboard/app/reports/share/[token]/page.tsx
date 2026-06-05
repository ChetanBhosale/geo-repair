"use client"

import type { ReactNode } from "react"
import { Download, FileText, Loader2, ShieldAlert } from "lucide-react"
import { useParams } from "next/navigation"
import { useSharedReport } from "@/hooks/use-reports"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ProfessionalReport } from "@/components/reports/professional-report"
import { ENDPOINTS } from "@/lib/endpoint"

export default function SharedReportPage() {
  const params = useParams<{ token?: string }>()
  const token = typeof params.token === "string" ? params.token : null
  const report = useSharedReport(token, !!token)

  if (!token) {
    return (
      <PublicShell>
        <State
          icon={<ShieldAlert className="size-5" />}
          title="Invalid share link"
          description="This report link is missing its share token."
        />
      </PublicShell>
    )
  }

  if (report.isLoading) {
    return (
      <PublicShell>
        <State
          icon={<Loader2 className="size-5 animate-spin" />}
          title="Loading shared report"
          description="We are retrieving the shared report artifact."
        />
      </PublicShell>
    )
  }

  if (report.isError || !report.data) {
    return (
      <PublicShell>
        <State
          icon={<ShieldAlert className="size-5" />}
          title="Shared report unavailable"
          description={
            report.isError
              ? (report.error as Error).message
              : "The report link may have expired or been revoked."
          }
        />
      </PublicShell>
    )
  }

  const data = report.data

  return (
    <PublicShell>
      <section className="grid gap-4">
        <ProfessionalReport
          actions={
            <Button asChild variant="outline">
              <a href={ENDPOINTS.sharedReportDownload(token)}>
                <Download className="size-4" />
                Download report
              </a>
            </Button>
          }
          report={data}
        />
      </section>
    </PublicShell>
  )
}

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-secondary px-4 py-6 text-primary sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div>
            <p className="font-mono text-xs tracking-wide text-secondary uppercase">
              Shared report
            </p>
            <h1 className="mt-1 text-xl font-semibold">geo.repair</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-secondary">
            <FileText className="size-3.5" />
            Read-only
          </div>
        </header>
        {children}
      </div>
    </main>
  )
}

function State({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-6">
        <div className="rounded-md p-2 text-secondary">{icon}</div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-secondary">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
