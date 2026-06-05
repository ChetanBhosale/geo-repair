"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CreditCard, GitBranch, Loader2 } from "lucide-react"
import type { CheckupProgress } from "@/lib/api"
import { useUser } from "@/hooks/use-auth"
import { useAudit } from "@/hooks/use-audit"
import { useCreateFixCheckout } from "@/hooks/use-billing"
import { useSavedRepos, useUpdateRepoWebsite } from "@/hooks/use-repos"
import { AuditReport } from "@/components/audit-report"
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

function readStoredUrl() {
  if (typeof window === "undefined") return ""
  return window.sessionStorage.getItem(URL_STORAGE_KEY) ?? ""
}

export default function WebsiteScanPage() {
  const router = useRouter()
  const [url, setUrl] = React.useState(readStoredUrl)
  const prefilledRepoId = React.useRef<string | null>(null)
  const audit = useAudit()
  const { isSignedIn } = useUser()
  const savedRepos = useSavedRepos(isSignedIn)
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

  function onStartCheckout() {
    if (!audit.result?.key || !selectedRepo) {
      return
    }

    checkout.mutate(
      {
        repositoryId: selectedRepo.id,
        checkupReportKey: audit.result.key,
      },
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

          {updateWebsite.error || audit.startError ? (
            <p className="text-sm text-destructive">
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
          <AuditReport report={audit.result.report} />
          <div className="flex flex-col gap-3 rounded-lg bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Ready for the paid fix</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {resultActionDescription(selectedRepo?.fullName)}
              </p>
              {checkout.error ? (
                <p className="mt-2 text-sm text-destructive">
                  {checkout.error.message}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedRepo ? (
                <Button disabled={checkout.isPending} onClick={onStartCheckout}>
                  {checkout.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CreditCard className="size-4" />
                  )}
                  Continue to payment
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/settings">
                    <GitBranch className="size-4" />
                    Choose repository
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </>
      ) : null}
    </DashboardShell>
  )
}

function phaseLabel(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Starting"
}

function resultActionDescription(selectedRepoFullName: string | undefined) {
  if (selectedRepoFullName) {
    return `Checkout will use ${selectedRepoFullName} and this scan report.`
  }

  return "Choose a repository before checkout so the fix can open a PR."
}

function ScanProgressPanel({ progress }: { progress: CheckupProgress | null }) {
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 5))
  const events = progress?.events.slice(-6).reverse() ?? []

  return (
    <div className="grid gap-3 rounded-lg bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="size-4 animate-spin" />
            {phaseLabel(progress?.phase)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {progress?.currentPageUrl
              ? `Reading ${progress.currentPageUrl}`
              : "Preparing crawl and score checks."}
          </p>
        </div>
        <span className="font-mono text-sm text-muted-foreground">
          {Math.round(percent)}%
        </span>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-background"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
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
          <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            Live log
          </p>
          <ul className="mt-2 grid gap-1.5">
            {events.map((event) => (
              <li
                className="rounded-lg bg-background px-3 py-2 text-xs"
                key={event.sequence}
              >
                <span className="font-mono text-muted-foreground">
                  #{event.sequence} {phaseLabel(event.phase)}
                </span>
                <span className="ml-2 text-foreground">{event.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function ProgressStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background px-3 py-2">
      <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm">{value}</p>
    </div>
  )
}
