"use client"

import type { SiteReport } from "@repo/types/scraper"
import { ChevronDown } from "lucide-react"
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

function statusVariant(status: string) {
  if (status === "pass") return "pass" as const
  if (status === "partial" || status === "mixed") return "partial" as const
  if (status === "fail") return "fail" as const
  return "muted" as const
}

function statusLabel(value: string) {
  return value.replaceAll("-", " ")
}

function pagePath(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}` || "/"
  } catch {
    return url
  }
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
  const strongestPages = [...report.pageIndex]
    .filter((page) => page.ok && !page.blocked)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 5)

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
        <CardContent className="flex flex-col">
          {findings.map((f) => (
            <details key={f.id} className="group py-3">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-lg px-2 py-1 transition-colors hover:bg-muted/40">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{f.id}</span>
                    <Badge variant="muted">{f.category}</Badge>
                    {f.fixableByAgent ? (
                      <Badge variant="partial">fixable</Badge>
                    ) : null}
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
                <span className="inline-flex items-center gap-2">
                  <Badge variant={statusVariant(f.siteStatus)}>
                    {statusLabel(f.siteStatus)}
                  </Badge>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <div className="grid gap-3 px-2 pt-3 pb-2">
                <div className="grid gap-2 rounded-lg bg-muted/20 p-3 text-xs text-muted-foreground sm:grid-cols-5">
                  <Stat label="Pass" value={String(f.counts.pass)} />
                  <Stat label="Partial" value={String(f.counts.partial)} />
                  <Stat label="Fail" value={String(f.counts.fail)} />
                  <Stat label="Weight" value={String(f.weight)} />
                  <Stat label="Tier" value={f.tier} />
                </div>

                {f.pages.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      Top affected pages shown now
                    </p>
                    <ul className="mt-2 grid gap-2">
                      {f.pages.slice(0, 5).map((page) => (
                        <li
                          className="rounded-lg bg-background px-3 py-2"
                          key={`${f.id}-${page.url}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-xs break-all">
                              {pagePath(page.url)}
                            </span>
                            <Badge variant={statusVariant(page.status)}>
                              {statusLabel(page.status)}
                            </Badge>
                          </div>
                          {page.evidence ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {page.evidence}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      Strongest pages contributing positively
                    </p>
                    <ul className="mt-2 grid gap-2">
                      {strongestPages.map((page) => (
                        <li
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2"
                          key={`${f.id}-${page.url}`}
                        >
                          <span className="font-mono text-xs break-all">
                            {pagePath(page.url)}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {Math.round(page.overall)}/100
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  Showing the first five examples. Full page-level evidence, fix
                  plan, and PR-ready changes unlock after the paid fix.
                </div>
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-wide uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
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
