"use client"

import { useParams } from "next/navigation"

import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  CategoryScoreRows,
  ScoreBlockStrip,
  ScoreSummary,
  type ScoreCategoryRow,
} from "@/components/dashboard/score-block-strip"
import { useProjectBySlug, useProjectScrapingBySlug } from "@/query/project.query"
import type { SiteCheck } from "@repo/types/scraping"

const RUBRIC_CATEGORY_ORDER = [
  "Rendering",
  "Structured data",
  "Metadata",
  "Crawl surface",
  "Semantics",
  "Content",
  "Answerability",
] as const

export default function ProjectScanSlugPage() {
  const params = useParams<{ projectSlug: string; scanSlug: string }>()
  const project = useProjectBySlug(params.projectSlug)
  const scan = useProjectScrapingBySlug(project.data?.id ?? "", params.scanSlug)
  const result = scan.data?.result ?? null

  const categoryRows: ScoreCategoryRow[] = result
    ? buildCategoryRows(result.checks, result.score.byCategory)
    : []

  if (project.isLoading || scan.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <DashboardInlineLoading rows={4} />
      </div>
    )
  }

  if (!project.data || !scan.data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">
        Scan not found.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title={scan.data.slug}
        description={`${project.data.name}, ${scan.data.status.toLowerCase()}`}
      />

      {result ? (
        <>
          <div className="mt-5 bg-card px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Score</p>
              <ScoreSummary score={result.score.overall} />
            </div>
            <ScoreBlockStrip
              score={result.score.overall}
              className="mt-3"
              barClassName="h-8"
            />
          </div>
          {categoryRows.length > 0 ? (
            <div className="mt-4 overflow-hidden bg-secondary">
              <CategoryScoreRows rows={categoryRows} />
            </div>
          ) : null}
          <div className="mt-4 max-h-96 space-y-2 overflow-y-auto bg-card p-4">
            {result.checks.map((check) => (
              <div key={check.name} className="bg-secondary px-3 py-2">
                <p className="text-sm font-medium">{check.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {check.summary}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-5 bg-card px-5 py-10 text-sm text-muted-foreground">
          No scan result stored yet.
        </div>
      )}
    </div>
  )
}

function buildCategoryRows(
  checks: SiteCheck[],
  byCategory: Record<string, { score: number; status: SiteCheck["status"] }>
): ScoreCategoryRow[] {
  const grouped = new Map<string, SiteCheck[]>()
  for (const check of checks) {
    const list = grouped.get(check.category) ?? []
    list.push(check)
    grouped.set(check.category, list)
  }

  const orderedCategories = [
    ...RUBRIC_CATEGORY_ORDER.filter((category) => grouped.has(category)),
    ...[...grouped.keys()].filter(
      (category) => !RUBRIC_CATEGORY_ORDER.includes(category as never)
    ),
  ]

  return orderedCategories.map((category) => {
    const sub = byCategory[category]
    return {
      category,
      score: sub && sub.status !== "NOT_APPLICABLE" ? Math.round(sub.score) : null,
      status: sub?.status ?? "INCONCLUSIVE",
      checks: grouped.get(category) ?? [],
    }
  })
}
