"use client"

import { useRef, useState, type FormEvent } from "react"
import {
  ArrowClockwiseIcon,
  ArrowRightIcon,
  DownloadSimpleIcon,
  GlobeSimpleIcon,
  MagnifyingGlassIcon,
  WarningCircleIcon,
  WrenchIcon,
} from "@phosphor-icons/react/ssr"

import FrontendSecrets from "@repo/secrets/frontend"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScoreRing } from "@/components/demo/score-ring"
import { capture } from "@/lib/analytics"
import { dashboardFixHref } from "@/lib/dashboard-url"
import {
  type ScanResult,
  type SiteCheck,
  categoryColor,
  hostnameOf,
  statusLabel,
  storeScan,
} from "@/lib/scan-result"

type FormState = "idle" | "running" | "complete" | "error"

const SCAN_ENDPOINT = `${FrontendSecrets.OPEN_BACKEND ?? ""}/scan-website`

function isErrorPayload(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string"
  )
}

function topIssues(result: ScanResult): SiteCheck[] {
  return result.checks
    .filter((check) => check.status === "FAILED" || check.status === "MID")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
}

export function FreeScanForm({
  inputId = "free-scan-url",
}: {
  inputId?: string
}) {
  const [url, setUrl] = useState("")
  const [state, setState] = useState<FormState>("idle")
  const [error, setError] = useState("")
  const [result, setResult] = useState<ScanResult | null>(null)
  const runIdRef = useRef(0)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state === "running") return

    const submittedUrl = url.trim()
    if (!submittedUrl) {
      setError("Enter a website URL to scan.")
      setState("error")
      return
    }

    const runId = runIdRef.current + 1
    runIdRef.current = runId
    setState("running")
    setError("")
    setResult(null)
    capture("checkup_started", { location: "hero", website: submittedUrl })

    try {
      const response = await fetch(SCAN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: submittedUrl }),
      })
      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const message = isErrorPayload(payload)
          ? payload.error
          : "The scan could not be completed."
        throw new Error(message)
      }

      const scan = payload as ScanResult
      if (runIdRef.current !== runId) return

      if (scan.status !== "completed") {
        throw new Error(scan.error ?? "We could not read this website.")
      }

      setResult(scan)
      storeScan(scan)
      setState("complete")
      capture("checkup_completed", {
        location: "hero",
        website: scan.finalUrl,
        overall: scan.score.overall,
        pages_checked: scan.crawl.pagesChecked,
      })
    } catch (err) {
      if (runIdRef.current !== runId) return
      const message =
        err instanceof Error ? err.message : "The scan could not be completed."
      setError(message)
      setState("error")
      capture("checkup_failed", { location: "hero", reason: message })
    }
  }

  function onDownloadReport() {
    if (!result) return
    storeScan(result)
    capture("report_downloaded", {
      location: "hero",
      website: result.finalUrl,
      overall: result.score.overall,
    })
    window.open("/report", "_blank", "noopener,noreferrer")
  }

  function onStartFix() {
    if (!result) return
    capture("fix_started", {
      location: "hero",
      website: result.finalUrl,
      overall: result.score.overall,
    })
  }

  const isBusy = state === "running"
  const issues = result ? topIssues(result) : []
  const categories = result
    ? Object.entries(result.score.byCategory)
        .filter(([, value]) => value.status !== "NOT_APPLICABLE")
        .map(([category, value]) => ({
          category,
          score: Math.round(value.score),
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
              type="text"
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
                Scanning
              </>
            ) : (
              <>
                <MagnifyingGlassIcon aria-hidden />
                Run free scan
              </>
            )}
          </Button>
        </div>
        <p
          className="text-center text-xs text-muted-foreground"
          aria-live="polite"
        >
          {isBusy
            ? "Fetching public pages and scoring AI search readiness. This can take up to a minute."
            : "Free AI search readiness scan. No signup or card needed."}
        </p>
      </form>

      {isBusy && (
        <div
          className="flex items-center gap-2.5 border border-border bg-card px-3 py-3 text-left text-sm text-muted-foreground"
          aria-live="polite"
        >
          <ArrowClockwiseIcon
            className="size-4 shrink-0 animate-spin text-primary"
            aria-hidden
          />
          <p>Scanning {hostnameOf(url.trim())} for AI search readiness.</p>
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

      {result && state === "complete" && (
        <div className="grid gap-px bg-border text-left" aria-live="polite">
          <div className="grid gap-px bg-border sm:grid-cols-[auto_1fr]">
            <div className="flex items-center justify-center bg-card p-4">
              <ScoreRing score={Math.round(result.score.overall)} size={104} />
            </div>
            <div className="flex flex-col justify-center gap-3 bg-card p-4">
              <div>
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Analyzed site
                </p>
                <p className="break-all text-sm font-medium text-foreground">
                  {hostnameOf(result.finalUrl)}
                </p>
              </div>
              <span className="w-fit border border-border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {result.crawl.pagesChecked}{" "}
                {result.crawl.pagesChecked === 1 ? "page" : "pages"} checked
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 bg-card p-4 sm:flex-row">
            <Button asChild size="lg" className="h-10 flex-1" onClick={onStartFix}>
              <a href={dashboardFixHref(result.finalUrl)}>
                <WrenchIcon aria-hidden />
                Start the fix
                <ArrowRightIcon aria-hidden />
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-10 flex-1"
              onClick={onDownloadReport}
            >
              <DownloadSimpleIcon aria-hidden />
              Download full report
            </Button>
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
            {issues.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {issues.map((issue) => (
                  <li
                    key={issue.name}
                    className="flex items-center justify-between gap-3 border border-border bg-background px-3 py-2"
                  >
                    <span className="min-w-0 text-xs font-medium text-foreground">
                      {issue.name}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {statusLabel(issue.status)}
                      {issue.affectedPages.length > 0
                        ? `, ${issue.affectedPages.length} ${
                            issue.affectedPages.length === 1 ? "page" : "pages"
                          }`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                No failing or partial checks were found in the scanned pages.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
