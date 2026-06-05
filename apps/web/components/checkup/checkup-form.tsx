"use client"

import { useRef, useState, type FormEvent } from "react"
import {
  ArrowClockwiseIcon,
  GlobeSimpleIcon,
  MagnifyingGlassIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/ssr"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScoreRing } from "@/components/demo/score-ring"
import { capture } from "@/lib/analytics"

type FormState = "idle" | "starting" | "running" | "complete" | "error"

type WebsiteType =
  | "nextjs"
  | "react"
  | "astro"
  | "framer"
  | "webflow"
  | "wix"
  | "wordpress"
  | "shopify"
  | "gatsby"
  | "nuxt"
  | "hugo"
  | "other"
  | "unknown"

type CategoryScore = {
  score: number
}

type Finding = {
  id: string
  weight: number
  siteStatus: "pass" | "partial" | "fail" | "mixed" | "not-applicable"
  affectedCount: number
}

type CheckupPhase =
  | "queued"
  | "fetching_homepage"
  | "reading_crawl_files"
  | "discovering_pages"
  | "scoring_pages"
  | "aggregating_report"
  | "saving_report"
  | "completed"
  | "failed"

type RecentCheckupPage = {
  url: string
  status: "completed" | "failed"
  score?: number
}

type CheckupProgress = {
  workflowId: string
  website: string
  status:
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "canceled"
    | "timed_out"
  phase: CheckupPhase
  percent: number
  pagesTotal: number
  pagesCompleted: number
  pagesFailed: number
  checksEvaluated: number
  issuesFound: number
  currentPageUrl: string | null
  recentPages: RecentCheckupPage[]
  resultKey: string | null
  error: string | null
  updatedAt: string
}

type SiteReport = {
  overall: number
  categories: Record<string, CategoryScore>
  crawl: {
    pagesChecked: number
  }
  siteInfo: {
    techStack: string[]
    websiteType: WebsiteType
  }
  findings: Finding[]
}

type StartCheckupResponse = {
  workflowId: string
  website: string
}

type CheckupSummary = {
  key: string
  website: string
  websiteType: WebsiteType
  overall: number
  pagesChecked: number
}

type CheckupStatusResponse =
  | { status: "RUNNING" | "PENDING"; progress: CheckupProgress | null }
  | {
      status: "COMPLETED"
      result: CheckupSummary
      progress: CheckupProgress | null
    }
  | {
      status: "FAILED" | "TERMINATED" | "CANCELED" | "TIMED_OUT"
      error: string
      progress: CheckupProgress | null
    }

type CheckupReportResponse = {
  key: string
  website: string
  websiteType: WebsiteType | null
  report: SiteReport
}

const MAX_POLLS = 450
const POLL_INTERVAL_MS = 2000

const WEBSITE_TYPE_LABELS: Record<WebsiteType, string> = {
  nextjs: "Next.js",
  react: "React",
  astro: "Astro",
  framer: "Framer",
  webflow: "Webflow",
  wix: "Wix",
  wordpress: "WordPress",
  shopify: "Shopify",
  gatsby: "Gatsby",
  nuxt: "Nuxt",
  hugo: "Hugo",
  other: "Other",
  unknown: "Unknown",
}

class RequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "RequestError"
    this.status = status
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function isErrorPayload(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  )
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const message = isErrorPayload(payload)
      ? payload.error
      : "The checkup could not be started."
    throw new RequestError(message, response.status)
  }

  return payload as T
}

function formatCheckId(id: string): string {
  return id
    .split("-")
    .map((part) => {
      if (part.toLowerCase() === "ai") return "AI"
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(" ")
}

function categoryColor(score: number): string {
  if (score >= 80) return "bg-success"
  if (score >= 50) return "bg-warning"
  return "bg-destructive"
}

function statusLabel(status: Finding["siteStatus"]): string {
  if (status === "mixed") return "mixed"
  if (status === "not-applicable") return "not applicable"
  return status
}

function topFindings(report: SiteReport): Finding[] {
  return report.findings
    .filter((finding) => finding.affectedCount > 0)
    .sort((a, b) => {
      if (b.affectedCount !== a.affectedCount) {
        return b.affectedCount - a.affectedCount
      }
      return b.weight - a.weight
    })
    .slice(0, 5)
}

function reportWebsiteType(result: CheckupReportResponse): WebsiteType {
  return result.report.siteInfo.websiteType ?? result.websiteType ?? "unknown"
}

function phaseLabel(phase: CheckupPhase): string {
  switch (phase) {
    case "queued":
      return "Queued"
    case "fetching_homepage":
      return "Fetching homepage"
    case "reading_crawl_files":
      return "Reading crawl files"
    case "discovering_pages":
      return "Discovering pages"
    case "scoring_pages":
      return "Scoring pages"
    case "aggregating_report":
      return "Aggregating report"
    case "saving_report":
      return "Saving report"
    case "completed":
      return "Checkup complete"
    case "failed":
      return "Checkup failed"
  }
}

function pageStatusLabel(status: RecentCheckupPage["status"]): string {
  return status === "completed" ? "checked" : "failed"
}

export function CheckupForm({
  inputId = "checkup-url",
}: {
  inputId?: string
}) {
  const [url, setUrl] = useState("")
  const [state, setState] = useState<FormState>("idle")
  const [error, setError] = useState("")
  const [result, setResult] = useState<CheckupReportResponse | null>(null)
  const [progress, setProgress] = useState<CheckupProgress | null>(null)
  const runIdRef = useRef(0)

  async function pollUntilComplete(
    workflowId: string,
    runId: number
  ): Promise<CheckupSummary> {
    for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
      await delay(POLL_INTERVAL_MS)
      if (runIdRef.current !== runId) {
        throw new RequestError("This checkup was replaced by a newer run.", 409)
      }

      const status = await fetchJson<CheckupStatusResponse>(
        `/api/checkups/${encodeURIComponent(workflowId)}/status`
      )

      if (runIdRef.current === runId) {
        setProgress(status.progress)
      }

      switch (status.status) {
        case "COMPLETED":
          return status.result
        case "RUNNING":
        case "PENDING":
          break
        default:
          throw new RequestError(status.error, 500)
      }
    }

    throw new RequestError("The checkup timed out. Please try again.", 408)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state === "starting" || state === "running") return

    const submittedUrl = url.trim()
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    setState("starting")
    setError("")
    setResult(null)
    setProgress(null)

    try {
      const started = await fetchJson<StartCheckupResponse>("/api/checkups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: submittedUrl, singlePage: false }),
      })

      capture("checkup_started", {
        location: "hero",
        website: started.website,
      })

      setState("running")
      const summary = await pollUntilComplete(started.workflowId, runId)
      const fullResult = await fetchJson<CheckupReportResponse>(
        `/api/checkup-reports/${encodeURIComponent(summary.key)}`
      )

      if (runIdRef.current !== runId) return

      setResult(fullResult)
      setState("complete")
      capture("checkup_completed", {
        location: "hero",
        website: fullResult.website,
        website_type: reportWebsiteType(fullResult),
        overall: fullResult.report.overall,
        pages_checked: fullResult.report.crawl.pagesChecked,
      })
    } catch (err) {
      if (runIdRef.current !== runId) return

      const message =
        err instanceof Error
          ? err.message
          : "The checkup could not be completed."
      const status = err instanceof RequestError ? err.status : undefined

      setError(
        status === 429
          ? "This site has reached the free checkup limit. Try another site or contact us."
          : message
      )
      setState("error")
      setProgress(null)
      capture("checkup_failed", {
        location: "hero",
        reason: message,
        status,
      })
    }
  }

  const isBusy = state === "starting" || state === "running"
  const completedReport = result?.report ?? null
  const websiteType = result ? reportWebsiteType(result) : "unknown"
  const currentPhase = progress?.phase ?? (state === "starting" ? "queued" : "fetching_homepage")
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round(progress?.percent ?? (state === "starting" ? 5 : 12)))
  )
  const findings = completedReport ? topFindings(completedReport) : []
  const categories = completedReport
    ? Object.entries(completedReport.categories).map(([category, score]) => ({
        category,
        score: Math.round(score.score),
      }))
    : []

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-2" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor={inputId} className="sr-only">
            Website URL
          </label>
          <div className="relative flex-1">
            <GlobeSimpleIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id={inputId}
              type="url"
              required
              inputMode="url"
              autoComplete="url"
              placeholder="https://example.com"
              value={url}
              disabled={isBusy}
              onChange={(event) => {
                setUrl(event.target.value)
                if (state === "error") {
                  setError("")
                  setState("idle")
                }
              }}
              className="h-10 pl-9 font-mono text-sm"
            />
          </div>
          <Button type="submit" size="lg" className="h-10" disabled={isBusy}>
            {isBusy ? (
              <>
                <ArrowClockwiseIcon className="animate-spin" aria-hidden />
                Running
              </>
            ) : (
              <>
                <MagnifyingGlassIcon aria-hidden />
                Run free scan
              </>
            )}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground" aria-live="polite">
          {state === "running"
            ? "Fetching public pages and scoring AI search readiness."
            : "Free AI search, AEO, and GEO scan. No signup or card needed."}
        </p>
      </form>

      {isBusy && (
        <div className="border border-border bg-card p-4 text-left" aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Checkup in progress
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {phaseLabel(currentPhase)}
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {progressPercent}%
            </span>
          </div>

          <div
            className="mt-3 h-2 w-full bg-muted"
            role="progressbar"
            aria-label="Checkup progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-3 grid gap-px bg-border sm:grid-cols-3">
            <div className="bg-background p-3">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Pages
              </p>
              <p className="mt-1 font-mono text-sm tabular-nums text-foreground">
                {progress?.pagesCompleted ?? 0}
                {progress?.pagesTotal ? ` / ${progress.pagesTotal}` : " / ..."}
              </p>
            </div>
            <div className="bg-background p-3">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Checks
              </p>
              <p className="mt-1 font-mono text-sm tabular-nums text-foreground">
                {progress?.checksEvaluated ?? 0}
              </p>
            </div>
            <div className="bg-background p-3">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Issues
              </p>
              <p className="mt-1 font-mono text-sm tabular-nums text-foreground">
                {progress?.issuesFound ?? 0}
              </p>
            </div>
          </div>

          {progress?.currentPageUrl && (
            <div className="mt-3 border border-border bg-background px-3 py-2">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Current page
              </p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">
                {progress.currentPageUrl}
              </p>
            </div>
          )}

          {progress?.recentPages.length ? (
            <div className="mt-3">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Recent pages
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {progress.recentPages.map((page, index) => (
                  <li
                    key={`${page.url}-${page.status}-${page.score ?? "none"}-${index}`}
                    className="flex items-center justify-between gap-3 border border-border bg-background px-3 py-2"
                  >
                    <span className="min-w-0 break-all font-mono text-xs text-foreground">
                      {page.url}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {pageStatusLabel(page.status)}
                      {typeof page.score === "number"
                        ? `, ${Math.round(page.score)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {state === "error" && (
        <div
          className="flex items-start gap-2.5 border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive"
          role="alert"
        >
          <WarningCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{error || "Something went wrong. Please try again."}</p>
        </div>
      )}

      {completedReport && (
        <div className="grid gap-px bg-border text-left" aria-live="polite">
          <div className="grid gap-px bg-border sm:grid-cols-[auto_1fr]">
            <div className="bg-card p-4">
              <ScoreRing score={Math.round(completedReport.overall)} size={104} />
            </div>
            <div className="flex flex-col justify-center gap-3 bg-card p-4">
              <div>
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Analyzed site
                </p>
                <p className="break-all text-sm font-medium text-foreground">
                  {result?.website}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground">
                  {WEBSITE_TYPE_LABELS[websiteType]}
                </span>
                <span className="border border-border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground">
                  {completedReport.crawl.pagesChecked} pages checked
                </span>
              </div>
              {completedReport.siteInfo.techStack.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Detected: {completedReport.siteInfo.techStack.join(", ")}
                </p>
              )}
            </div>
          </div>

          {categories.length > 0 && (
            <div className="grid gap-px bg-border sm:grid-cols-2">
              {categories.map((category) => (
                <div key={category.category} className="bg-card p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-medium text-foreground">
                      {category.category}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {category.score}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-1.5 w-full bg-muted"
                    role="img"
                    aria-label={`${category.category}: ${category.score} out of 100`}
                  >
                    <div
                      className={`h-full ${categoryColor(category.score)}`}
                      style={{ width: `${category.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Top issues
              </p>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  runIdRef.current += 1
                  setResult(null)
                  setState("idle")
                  setError("")
                }}
              >
                Run another
              </Button>
            </div>
            {findings.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {findings.map((finding) => (
                  <li
                    key={finding.id}
                    className="flex items-center justify-between gap-3 border border-border bg-background px-3 py-2"
                  >
                    <span className="text-xs font-medium text-foreground">
                      {formatCheckId(finding.id)}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {statusLabel(finding.siteStatus)}, {finding.affectedCount}{" "}
                      {finding.affectedCount === 1 ? "page" : "pages"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No failing or partial checks were found in the checked pages.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
