"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bot, Download, GitBranch, Loader2 } from "lucide-react"
import type { BillingOrder, FixTier } from "@repo/types/billing"
import type { SiteReport } from "@repo/types/scraper"
import type { CheckupProgress } from "@/lib/api"
import { useUser } from "@/hooks/use-auth"
import { useAudit } from "@/hooks/use-audit"
import { useScanQuota } from "@/hooks/use-scan-quota"
import { useBillingHistory, useCreateFixCheckout, usePlans } from "@/hooks/use-billing"
import { useSavedRepos, useUpdateRepoWebsite } from "@/hooks/use-repos"
import { AuditReport } from "@/components/audit-report"
import { FixTierCheckoutDialog } from "@/components/billing/fix-tier-checkout-dialog"
import { DashboardShell } from "@/components/dashboard-shell"
import { StatePanel } from "@/components/state-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const URL_STORAGE_KEY = "geo-repair:dashboard:website-scan-url"

type SelfServeFixTier = Exclude<FixTier, "ENTERPRISE_CUSTOM">

const REUSABLE_ORDER_STATUSES = new Set<BillingOrder["status"]>([
  "PENDING",
  "CHECKOUT_CREATED",
  "PROCESSING",
  "PAID",
])

function readStoredUrl() {
  if (typeof window === "undefined") return ""
  return window.sessionStorage.getItem(URL_STORAGE_KEY) ?? ""
}

function comparableWebsite(value: string) {
  try {
    const parsed = new URL(value)
    parsed.hash = ""
    parsed.search = ""
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/"
    return parsed.toString().replace(/\/+$/, "")
  } catch {
    return value.trim().replace(/\/+$/, "")
  }
}

export default function WebsiteScanPage() {
  const router = useRouter()
  const [url, setUrl] = React.useState(readStoredUrl)
  const [checkoutDialogOpen, setCheckoutDialogOpen] = React.useState(false)
  const prefilledRepoId = React.useRef<string | null>(null)
  const audit = useAudit()
  const { isSignedIn } = useUser()
  const scanQuota = useScanQuota(isSignedIn)
  const savedRepos = useSavedRepos(isSignedIn)
  const billing = useBillingHistory(isSignedIn)
  const plans = usePlans()
  const updateWebsite = useUpdateRepoWebsite()
  const checkout = useCreateFixCheckout()
  const repositories = savedRepos.data ?? []
  const selectedRepo =
    repositories.find((repository) => repository.selected) ??
    repositories[0] ??
    null

  React.useEffect(() => {
    if (
      selectedRepo?.website &&
      prefilledRepoId.current !== selectedRepo.id &&
      !url.trim()
    ) {
      setUrl(selectedRepo.website)
      prefilledRepoId.current = selectedRepo.id
    }
  }, [selectedRepo?.id, selectedRepo?.website, url])

  const existingFixOrder = React.useMemo(() => {
    const report = audit.result?.report
    const orders = billing.data?.orders ?? []
    if (!selectedRepo || !report || orders.length === 0) {
      return null
    }

    const reportUrls = new Set([
      comparableWebsite(report.url),
      comparableWebsite(report.origin),
    ])
    const matchingOrders = orders.filter(
      (order) =>
        order.repoFullName === selectedRepo.fullName &&
        reportUrls.has(comparableWebsite(order.website)) &&
        REUSABLE_ORDER_STATUSES.has(order.status)
    )

    return (
      matchingOrders.find((order) => order.status === "PAID") ??
      matchingOrders[0] ??
      null
    )
  }, [
    audit.result?.report,
    billing.data?.orders,
    selectedRepo,
  ])

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      return
    }

    if (selectedRepo) {
      updateWebsite.mutate(
        { repositoryId: selectedRepo.id, website: trimmed },
        {
          onSuccess: (repo) => {
            const scanUrl = repo.website ?? trimmed
            window.sessionStorage.setItem(URL_STORAGE_KEY, scanUrl)
            audit.start.mutate({ url: scanUrl, singlePage: false })
          },
        }
      )
      return
    }

    window.sessionStorage.setItem(URL_STORAGE_KEY, trimmed)
    audit.start.mutate({ url: trimmed, singlePage: false })
  }

  function continueOrder(orderId: string) {
    checkout.mutate(
      { orderId },
      {
        onSuccess: ({ checkoutUrl, order }) => {
          if (checkoutUrl) {
            window.location.assign(checkoutUrl)
            return
          }

          router.push(`/fix-agent?order_id=${encodeURIComponent(order.id)}`)
        },
      }
    )
  }

  function onFixWithAgent() {
    if (existingFixOrder) {
      continueOrder(existingFixOrder.id)
      return
    }

    setCheckoutDialogOpen(true)
  }

  function onStartCheckout(selectedTier: SelfServeFixTier) {
    if (!audit.result?.key || !selectedRepo) {
      return
    }

    checkout.mutate(
      {
        repositoryId: selectedRepo.id,
        checkupReportKey: audit.result.key,
        selectedTier,
      },
      {
        onSuccess: ({ checkoutUrl, order }) => {
          if (checkoutUrl) {
            window.location.assign(checkoutUrl)
            return
          }

          setCheckoutDialogOpen(false)
          router.push(`/fix-agent?order_id=${encodeURIComponent(order.id)}`)
        },
      }
    )
  }

  function onDownloadReport() {
    const report = audit.result?.report
    if (!report) {
      return
    }

    const blob = new Blob([buildScanReportHtml(report)], {
      type: "text/html;charset=utf-8",
    })
    const href = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = href
    link.download = `${downloadFilePart(report.siteInfo.name ?? report.url)}-ai-search-report.html`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(href)
  }

  const busy =
    updateWebsite.isPending ||
    audit.isStarting ||
    audit.isPolling ||
    audit.isLoadingResult

  return (
    <DashboardShell eyebrow="Website scan" title="AI Search readiness scan">
      <Card>
        <CardHeader>
          <CardTitle>Scan a website</CardTitle>
          <CardDescription>
            Run the readiness audit, then continue into the fix agent with the
            active project selected.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={onSubmit}>
            <Input
              autoFocus
              disabled={busy}
              inputMode="url"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              type="text"
              value={url}
            />
            <Button disabled={busy || !url.trim()} type="submit">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {updateWebsite.isPending
                ? "Saving"
                : audit.isStarting
                  ? "Starting"
                  : audit.isPolling
                    ? "Scanning"
                    : audit.isLoadingResult
                      ? "Loading"
                      : "Run scan"}
            </Button>
          </form>

          {scanQuota.data ? (
            <p className="text-xs text-secondary">
              {scanQuota.data.remaining} of {scanQuota.data.limit} free scans
              left today. Re-scanning the same site within 24 hours is free.
            </p>
          ) : null}

          {updateWebsite.error || audit.startError ? (
            <p className="text-sm text-danger">
              {(updateWebsite.error ?? audit.startError)?.message}
            </p>
          ) : null}

          {audit.isPolling ? (
            <ScanProgressPanel progress={audit.progress} />
          ) : null}

          {audit.failed ? (
            <StatePanel
              eyebrow="Scan failed"
              title="The website scan did not complete"
              description={`The workflow ended with ${audit.statusName?.toLowerCase() ?? "an error"}. Try again or contact support if it repeats.`}
              tone="danger"
            />
          ) : null}
        </CardContent>
      </Card>

      {audit.result?.report ? (
        <>
          <AuditReport
            actions={
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {selectedRepo ? (
                    <Button
                      disabled={checkout.isPending}
                      onClick={onFixWithAgent}
                      type="button"
                    >
                      {checkout.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Bot className="size-4" />
                      )}
                      {existingFixOrder?.status === "PAID"
                        ? "Continue to fix"
                        : existingFixOrder
                          ? "Continue checkout"
                          : "Fix with agent"}
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link href="/settings">
                        <GitBranch className="size-4" />
                        Choose repository
                      </Link>
                    </Button>
                  )}
                  <Button
                    onClick={onDownloadReport}
                    type="button"
                    variant="outline"
                  >
                    <Download className="size-4" />
                    Download report
                  </Button>
                </div>
                {checkout.error ? (
                  <p className="max-w-72 text-xs text-danger sm:text-right">
                    {checkout.error.message}
                  </p>
                ) : null}
              </div>
            }
            report={audit.result.report}
          />
          <FixTierCheckoutDialog
            error={checkout.error}
            onCheckout={onStartCheckout}
            onOpenChange={setCheckoutDialogOpen}
            open={checkoutDialogOpen}
            pageCount={audit.result.report.crawl.pagesChecked}
            plans={plans.data ?? []}
            pending={checkout.isPending}
          />
        </>
      ) : null}
    </DashboardShell>
  )
}

function phaseLabel(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Starting"
}

function downloadFilePart(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "website"
  )
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function buildScanReportHtml(report: SiteReport) {
  const title = report.siteInfo.name ?? "AI Search readiness report"
  const logoSvg = `<svg class="mark" aria-hidden="true" fill="currentColor" viewBox="0 0 491 492" xmlns="http://www.w3.org/2000/svg">
    <path d="M233.46 0.529372C275.545 -2.73113 323.87 9.34336 360.745 29.2084C419.08 60.4394 462.355 113.872 480.79 177.421L424.85 177.542C418.555 160.775 409.91 144.99 399.165 130.661C365.91 86.4364 320.79 62.1964 266.64 54.4749L266.795 138.564C252.525 138.666 238.055 138.49 223.766 138.433L223.822 54.6314C189.536 57.2304 151.586 74.5309 125 95.9164C85.2106 127.702 59.7936 174.087 54.4156 224.728C81.9791 224.223 110.34 224.47 137.937 224.437L137.94 267.406L54.2286 267.316C65.8211 358.541 132.76 424.881 223.795 437.076L223.782 353.321H266.79L266.765 437.096C268.675 436.896 270.86 436.521 272.785 436.241C304.38 431.946 337.225 417.671 362.235 398.151C405.5 364.381 429.345 321.231 436.445 267.356L352.64 267.331L352.695 224.376L489.785 224.37C490.535 240.131 491.12 249.541 489.925 265.491C485.775 318.551 464.34 368.791 428.91 408.506C385.72 457.441 324.775 487.106 259.62 490.911C194.748 494.836 131.002 472.666 82.5646 429.336C33.7881 386.286 4.24058 325.531 0.496577 260.581C-3.70242 194.912 18.8636 130.342 63.0521 81.5854C107.272 32.0369 167.477 4.35937 233.46 0.529372Z" />
    <path d="M241.291 200.017C266.621 197.857 288.906 216.642 291.061 241.97C293.216 267.3 274.426 289.585 249.096 291.735C223.772 293.89 201.496 275.105 199.34 249.78C197.185 224.455 215.965 202.176 241.291 200.017Z" />
  </svg>`
  const summaryItems = [
    ...report.summary.bad.map((item) => ["Needs work", item] as const),
    ...report.summary.missing.map((item) => ["Missing", item] as const),
    ...report.summary.good
      .slice(0, 5)
      .map((item) => ["Working", item] as const),
  ]
  const findings = report.findings
    .filter(
      (finding) =>
        finding.siteStatus !== "pass" && finding.siteStatus !== "not-applicable"
    )
    .sort((a, b) => b.affectedCount - a.affectedCount)
    .slice(0, 12)

  const summaryHtml =
    summaryItems.length > 0
      ? summaryItems
          .map(
            ([label, item]) =>
              `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(item)}</li>`
          )
          .join("")
      : "<li>No summary available.</li>"

  const findingsHtml =
    findings.length > 0
      ? findings
          .map(
            (finding) => `<li>
              <strong>${escapeHtml(finding.id)}</strong>
              <span>${escapeHtml(finding.category)} · ${escapeHtml(finding.siteStatus)} · ${finding.affectedCount} affected page(s)</span>
              ${
                finding.representativeEvidence
                  ? `<small>${escapeHtml(finding.representativeEvidence)}</small>`
                  : ""
              }
            </li>`
          )
          .join("")
      : "<li>No priority findings.</li>"

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | GEO Repair</title>
    <style>
      :root {
        --paper: #ffffff;
        --ink: #171717;
        --muted: #5f6362;
        --line: #d8dedb;
        --soft: #f5f7f6;
        --brand: #16825d;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      @page { size: A4; margin: 18mm; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #eef2f0; color: var(--ink); }
      .page { width: min(1040px, calc(100vw - 32px)); margin: 32px auto; border: 1px solid var(--line); background: var(--paper); }
      header { padding: 40px; border-bottom: 1px solid var(--line); background: linear-gradient(180deg, #fff 0%, #f7faf8 100%); }
      .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; }
      .mark { width: 28px; height: 28px; color: var(--brand); }
      .eyebrow, .meta span, .score span, .section-label { color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; }
      h1 { max-width: 780px; margin: 32px 0 12px; font-size: 44px; line-height: 1.04; }
      .summary { max-width: 760px; margin: 0; color: var(--muted); font-size: 17px; line-height: 1.65; }
      .meta-grid, .scores { display: grid; gap: 16px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .meta-grid { margin-top: 32px; }
      .meta, .score { border: 1px solid var(--line); background: var(--soft); padding: 16px; }
      .meta strong, .score strong { display: block; margin-top: 8px; overflow-wrap: anywhere; }
      .score strong { color: var(--brand); font-size: 30px; }
      main { padding: 32px 40px 40px; }
      section + section { margin-top: 30px; padding-top: 30px; border-top: 1px solid var(--line); }
      h2 { margin: 8px 0 12px; font-size: 24px; }
      ul { display: grid; gap: 10px; padding: 0; margin: 0; list-style: none; }
      li { border-left: 4px solid var(--brand); background: var(--soft); padding: 12px 14px; line-height: 1.55; }
      li span, li small { display: block; color: var(--muted); }
      li small { margin-top: 6px; font-size: 12px; }
      .note { margin-top: 30px; border: 1px solid var(--line); background: var(--soft); padding: 16px; color: var(--muted); line-height: 1.6; }
      footer { padding: 24px 40px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
      @media (max-width: 760px) {
        .page { width: 100%; margin: 0; border-left: 0; border-right: 0; }
        header, main, footer { padding-left: 20px; padding-right: 20px; }
        .meta-grid, .scores { grid-template-columns: 1fr; }
        h1 { font-size: 32px; }
      }
      @media print {
        body { background: #fff; }
        .page { width: auto; margin: 0; border: 0; }
      }
    </style>
  </head>
  <body>
    <article class="page">
      <header>
        <div class="brand">${logoSvg} GEO Repair</div>
        <p class="eyebrow">AI Search readiness report</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="summary">Technical readiness scan for ${escapeHtml(report.url)}. This report shows what AI search engines can read today and what should be fixed first.</p>
        <div class="meta-grid">
          <div class="meta"><span>Website</span><strong>${escapeHtml(report.url)}</strong></div>
          <div class="meta"><span>Generated</span><strong>${escapeHtml(new Date(report.fetchedAt).toLocaleString())}</strong></div>
          <div class="meta"><span>Pages analyzed</span><strong>${report.crawl.pagesChecked}</strong></div>
          <div class="meta"><span>Read mode</span><strong>Static HTML</strong></div>
        </div>
      </header>
      <main>
        <section class="scores" aria-label="Scores">
          <div class="score"><span>Overall</span><strong>${Math.round(report.overall)}</strong></div>
          <div class="score"><span>SEO</span><strong>${Math.round(report.pillars.seo.score)}</strong></div>
          <div class="score"><span>AI Search</span><strong>${Math.round(report.pillars.geo.score)}</strong></div>
          <div class="score"><span>AEO</span><strong>${Math.round(report.pillars.aeo.score)}</strong></div>
        </section>
        <section>
          <p class="section-label">Section 1</p>
          <h2>Executive summary</h2>
          <ul>${summaryHtml}</ul>
        </section>
        <section>
          <p class="section-label">Section 2</p>
          <h2>Priority findings</h2>
          <ul>${findingsHtml}</ul>
        </section>
        <div class="note">This measures technical AI Search readiness. It does not promise rankings, traffic, or citations. GEO Repair avoids raw source code, secrets, full terminal logs, and private repository file contents in client-facing reports.</div>
      </main>
      <footer>Generated by GEO Repair.</footer>
    </article>
  </body>
</html>`
}

function ScanProgressPanel({ progress }: { progress: CheckupProgress | null }) {
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 5))
  const events = progress?.events.slice(-6).reverse() ?? []
  const activePageLabel = progress?.currentPageUrl
    ? `Reading ${progress.currentPageUrl}`
    : "Preparing crawl and score checks."

  return (
    <div className="scan-progress-motion relative grid gap-3 overflow-hidden rounded-lg bg-secondary/20 p-4">
      <ScanProgressMotionStyles />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/70 to-transparent"
        style={{ animation: "scan-sweep 2.4s ease-in-out infinite" }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="relative flex size-4 items-center justify-center">
              <span
                className="absolute size-4 rounded-full bg-brand/25"
                style={{ animation: "scan-ping 1.4s ease-out infinite" }}
              />
              <span className="relative size-2 rounded-full bg-brand" />
            </span>
            {phaseLabel(progress?.phase)}
          </p>
          <p
            className="mt-1 truncate text-xs text-secondary transition-opacity duration-300"
            key={activePageLabel}
            style={{ animation: "scan-fade-up 180ms ease-out" }}
          >
            {activePageLabel}
          </p>
        </div>
        <span
          className="font-mono text-sm text-secondary transition-transform duration-300"
          key={Math.round(percent)}
          style={{ animation: "scan-fade-up 180ms ease-out" }}
        >
          {Math.round(percent)}%
        </span>
      </div>

      <div
        className="relative h-2 overflow-hidden rounded-full bg-primary"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="relative h-full overflow-hidden rounded-full bg-brand"
          style={{
            width: `${percent}%`,
            transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 right-0 w-16 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            style={{ animation: "scan-shimmer 1.5s ease-in-out infinite" }}
          />
        </div>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-4">
        <ProgressStat
          label="Pages"
          value={`${progress?.pagesCompleted ?? 0}/${progress?.pagesTotal ?? 0}`}
        />
        <ProgressStat
          label="Failed"
          value={String(progress?.pagesFailed ?? 0)}
        />
        <ProgressStat
          label="Checks"
          value={String(progress?.checksEvaluated ?? 0)}
        />
        <ProgressStat
          label="Issues"
          value={String(progress?.issuesFound ?? 0)}
        />
      </div>

      {events.length > 0 ? (
        <div>
          <p className="font-mono text-[10px] tracking-wide text-secondary uppercase">
            Live log
          </p>
          <ul className="mt-2 grid gap-1.5">
            {events.map((event, index) => (
              <li
                className="rounded-lg bg-primary px-3 py-2 text-xs"
                key={eventKey(event, index)}
                style={{
                  animation: "scan-fade-up 220ms ease-out both",
                  animationDelay: `${index * 35}ms`,
                }}
              >
                <span className="font-mono text-secondary">
                  #{event.sequence} {phaseLabel(event.phase)}
                </span>
                <span className="ml-2 text-primary">{event.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function eventKey(event: CheckupProgress["events"][number], index: number) {
  return `${event.sequence}-${event.createdAt}-${event.type}-${event.pageUrl ?? ""}-${event.message}-${index}`
}

function ProgressStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg bg-primary px-3 py-2 transition-colors duration-300"
      style={{ animation: "scan-fade-up 180ms ease-out" }}
    >
      <p className="font-mono text-[10px] tracking-wide text-secondary uppercase">
        {label}
      </p>
      <p className="mt-1 overflow-hidden font-mono text-sm">
        <span
          className="inline-block"
          key={`${label}-${value}`}
          style={{ animation: "scan-fade-up 180ms ease-out" }}
        >
          {value}
        </span>
      </p>
    </div>
  )
}

function ScanProgressMotionStyles() {
  return (
    <style>{`
      @keyframes scan-sweep {
        0% { transform: translateX(-100%); opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        100% { transform: translateX(100%); opacity: 0; }
      }

      @keyframes scan-shimmer {
        0% { transform: translateX(-140%); }
        100% { transform: translateX(140%); }
      }

      @keyframes scan-ping {
        0% { transform: scale(0.65); opacity: 0.75; }
        100% { transform: scale(1.85); opacity: 0; }
      }

      @keyframes scan-fade-up {
        from { transform: translateY(4px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .scan-progress-motion,
        .scan-progress-motion * {
          animation: none !important;
          transition: none !important;
        }
      }
    `}</style>
  )
}
