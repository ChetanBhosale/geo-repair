"use client"

import type { ReactNode } from "react"
import type { Category, RubricFinding, SiteReport } from "@repo/types/scraper"
import {
  Bot,
  Braces,
  ChevronDown,
  Code2,
  FileText,
  Gauge,
  ListTree,
  type LucideIcon,
  MessageCircleQuestion,
  MessageSquareText,
  Radar,
  Search,
  Tags,
  Wrench,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function scoreColor(score: number) {
  if (score >= 80) return "text-success dark:text-success"
  if (score >= 50) return "text-warning dark:text-warning"
  return "text-danger"
}

function statusVariant(status: string) {
  if (status === "pass") return "pass" as const
  if (status === "partial" || status === "mixed") return "partial" as const
  if (status === "fail") return "fail" as const
  return "neutral" as const
}

function statusLabel(value: string) {
  return value.replaceAll("-", " ")
}

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  Rendering: Code2,
  "Structured data": Braces,
  Metadata: Tags,
  "Crawl surface": Radar,
  Semantics: ListTree,
  Content: FileText,
  Answerability: MessageCircleQuestion,
}

function pagePath(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}` || "/"
  } catch {
    return url
  }
}

const NEEDS_WORK_RANK: Record<string, number> = {
  fail: 0,
  mixed: 1,
  partial: 2,
}

function metaLine(f: RubricFinding) {
  const parts: string[] = [f.category]
  parts.push(f.scope === "site-wide" ? "Site-wide" : "Per-page")
  if (f.affectedCount > 0) {
    parts.push(`${f.affectedCount} page${f.affectedCount === 1 ? "" : "s"}`)
  }
  return parts.join(" · ")
}

export function AuditReport({
  actions,
  report,
}: {
  actions?: ReactNode
  report: SiteReport
}) {
  const needsWork = report.findings
    .filter((f) => f.siteStatus !== "pass" && f.siteStatus !== "not-applicable")
    .sort((a, b) => {
      const byStatus =
        (NEEDS_WORK_RANK[a.siteStatus] ?? 9) -
        (NEEDS_WORK_RANK[b.siteStatus] ?? 9)
      return byStatus !== 0 ? byStatus : b.affectedCount - a.affectedCount
    })
  const passing = report.findings.filter((f) => f.siteStatus === "pass")
  const notApplicable = report.findings.filter(
    (f) => f.siteStatus === "not-applicable"
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Overall + pillars */}
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>{report.siteInfo.name ?? report.url}</CardTitle>
            <CardDescription className="mt-1 break-all">
              {report.url} · {report.crawl.pagesChecked} page(s) analyzed
            </CardDescription>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              {actions}
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ScoreStat icon={Gauge} label="Overall" value={report.overall} />
          <ScoreStat icon={Search} label="SEO" value={report.pillars.seo.score} />
          <ScoreStat
            icon={Bot}
            label="AI Search"
            value={report.pillars.geo.score}
          />
          <ScoreStat
            icon={MessageSquareText}
            label="AEO"
            value={report.pillars.aeo.score}
          />
        </CardContent>
      </Card>

      {/* Findings */}
      <Card>
        <CardHeader>
          <CardTitle>Findings</CardTitle>
          <CardDescription>
            {needsWork.length} need attention
            {passing.length > 0 ? ` · ${passing.length} passing` : ""}
            {notApplicable.length > 0
              ? ` · ${notApplicable.length} not applicable`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {needsWork.length > 0 ? (
            <div className="divide-y divide-tertiary">
              {needsWork.map((f) => (
                <details key={f.id} className="group py-2 first:pt-0">
                  <summary className="flex cursor-pointer list-none items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/40">
                    <CategoryIcon category={f.category} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{f.id}</span>
                        {f.fixableByAgent ? (
                          <Wrench
                            aria-label="Fixable by the agent"
                            className="size-3.5 shrink-0 text-brand"
                          />
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-secondary">
                        {metaLine(f)}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-2">
                      <Badge variant={statusVariant(f.siteStatus)}>
                        {statusLabel(f.siteStatus)}
                      </Badge>
                      <ChevronDown className="size-4 text-secondary transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="grid gap-3 px-2 pt-2 pb-1">
                    {f.representativeEvidence ? (
                      <p className="text-xs text-secondary">
                        <span className="font-medium text-primary">
                          Example:{" "}
                        </span>
                        {f.representativeEvidence}
                      </p>
                    ) : null}

                    {f.pages.length > 0 ? (
                      <ul className="grid gap-2">
                        {f.pages.slice(0, 5).map((page) => (
                          <li
                            className="rounded-lg bg-secondary/30 px-3 py-2"
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
                              <p className="mt-1 text-xs text-secondary">
                                {page.evidence}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <p className="text-sm text-secondary">
              No issues found — every applicable check is passing.
            </p>
          )}

          {passing.length > 0 ? (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors hover:bg-secondary/40">
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-success" />
                  Passing checks ({passing.length})
                </span>
                <ChevronDown className="size-4 text-secondary transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-2 grid gap-1 px-2 sm:grid-cols-2">
                {passing.map((f) => {
                  const Icon = CATEGORY_ICON[f.category]
                  return (
                    <li
                      className="flex items-center gap-2 py-1 text-sm"
                      key={f.id}
                    >
                      <Icon className="size-3.5 shrink-0 text-secondary" />
                      <span className="truncate">{f.id}</span>
                      <span className="ml-auto shrink-0 text-xs text-secondary">
                        {f.category}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </details>
          ) : null}

          {notApplicable.length > 0 ? (
            <p className="px-2 text-xs text-secondary">
              <span className="font-medium">Not applicable:</span>{" "}
              {notApplicable.map((f) => f.id).join(", ")}
            </p>
          ) : null}

          <div className="rounded-lg bg-brand/5 px-3 py-2 text-xs text-secondary">
            Each finding shows up to five example pages. Full page-level evidence,
            the fix plan, and PR-ready changes unlock after the paid fix.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CategoryIcon({ category }: { category: Category }) {
  const Icon = CATEGORY_ICON[category]
  return (
    <span
      aria-hidden
      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-secondary"
    >
      <Icon className="size-4" />
    </span>
  )
}

function ScoreStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5 text-xs tracking-wide text-secondary uppercase">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className={`text-2xl font-semibold ${scoreColor(value)}`}>
        {Math.round(value)}
      </span>
    </div>
  )
}
