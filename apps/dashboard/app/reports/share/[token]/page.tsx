"use client"

import type { ReactNode } from "react"
import { Download, FileText, Loader2, ShieldAlert } from "lucide-react"
import { useParams } from "next/navigation"
import { useSharedReport } from "@/hooks/use-reports"
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
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{data.title}</CardTitle>
                <CardDescription>{data.summary}</CardDescription>
              </div>
              <Badge variant={data.status === "READY" ? "pass" : "muted"}>
                {data.status.toLowerCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {data.content.metrics.map((metric) => (
                <Metric
                  detail={metric.detail}
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>{data.website ?? "No website"}</span>
              <span>{data.repoFullName ?? "No repository"}</span>
              <span>{new Date(data.generatedAt).toLocaleString()}</span>
            </div>
            <Button asChild className="w-fit" variant="outline">
              <a href={ENDPOINTS.sharedReportDownload(token)}>
                <Download className="size-4" />
                Download report
              </a>
            </Button>
          </CardContent>
        </Card>

        {data.content.sections.map((section) => (
          <Card key={section.heading}>
            <CardHeader>
              <CardTitle>{section.heading}</CardTitle>
              <CardDescription>{section.body}</CardDescription>
            </CardHeader>
            {section.items.length > 0 ? (
              <CardContent>
                <ul className="grid gap-2 text-sm">
                  {section.items.map((item) => (
                    <li
                      className="rounded-md border border-border bg-muted/25 px-3 py-2"
                      key={item}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            ) : null}
          </Card>
        ))}
      </section>
    </PublicShell>
  )
}

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
              Shared report
            </p>
            <h1 className="mt-1 text-xl font-semibold">geo.repair</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
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
        <div className="rounded-md border border-border p-2 text-muted-foreground">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
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
