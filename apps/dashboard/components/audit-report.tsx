"use client"

import type { SiteReport, RubricFinding } from "@repo/types/scraper"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 50) return "text-amber-600 dark:text-amber-400"
  return "text-destructive"
}

function statusVariant(status: RubricFinding["siteStatus"]) {
  if (status === "pass") return "pass" as const
  if (status === "partial" || status === "mixed") return "partial" as const
  if (status === "fail") return "fail" as const
  return "muted" as const
}

export function AuditReport({ report }: { report: SiteReport }) {
  const findings = [...report.findings].sort((a, b) => {
    const rank = {
      fail: 0,
      mixed: 1,
      partial: 2,
      "not-applicable": 3,
      pass: 4,
    } as const
    return rank[a.siteStatus] - rank[b.siteStatus]
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Overall + pillars */}
      <Card>
        <CardHeader>
          <CardTitle>{report.siteInfo.name ?? report.url}</CardTitle>
          <CardDescription>
            {report.url} · {report.crawl.pagesChecked} page(s) analyzed
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ScoreStat label="Overall" value={report.overall} />
          <ScoreStat label="SEO" value={report.pillars.seo.score} />
          <ScoreStat label="AI Search" value={report.pillars.geo.score} />
          <ScoreStat label="AEO" value={report.pillars.aeo.score} />
        </CardContent>
      </Card>

      {/* Findings */}
      <Card>
        <CardHeader>
          <CardTitle>Findings</CardTitle>
          <CardDescription>
            {findings.length} checks across the site
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {findings.map((f) => (
            <div
              key={f.id}
              className="flex items-start justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{f.id}</span>
                  <Badge variant="muted">{f.category}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {f.scope === "site-wide" ? "Site-wide" : "Per-page"}
                  {f.affectedCount > 0
                    ? ` · ${f.affectedCount} affected page(s)`
                    : ""}
                  {f.representativeEvidence
                    ? ` · ${f.representativeEvidence}`
                    : ""}
                </p>
              </div>
              <Badge variant={statusVariant(f.siteStatus)}>
                {f.siteStatus}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ScoreStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className={`text-2xl font-semibold ${scoreColor(value)}`}>
        {Math.round(value)}
      </span>
    </div>
  )
}
