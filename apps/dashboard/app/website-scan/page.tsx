"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, CreditCard, GitBranch, Loader2 } from "lucide-react"
import { loginWithGithub, useUser } from "@/hooks/use-auth"
import { useAudit } from "@/hooks/use-audit"
import { useCreateFixCheckout } from "@/hooks/use-billing"
import { useSavedRepos } from "@/hooks/use-repos"
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

export default function WebsiteScanPage() {
  const router = useRouter()
  const [url, setUrl] = React.useState("")
  const audit = useAudit()
  const { isSignedIn, isLoading: isUserLoading } = useUser()
  const savedRepos = useSavedRepos(isSignedIn)
  const checkout = useCreateFixCheckout()
  const repositories = savedRepos.data ?? []
  const selectedRepo =
    repositories.find((repository) => repository.selected) ??
    repositories[0] ??
    null

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      return
    }
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

  const busy = audit.isStarting || audit.isPolling || audit.isLoadingResult

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
              {audit.isStarting
                ? "Starting"
                : audit.isPolling
                  ? "Scanning"
                  : audit.isLoadingResult
                    ? "Loading"
                    : "Run scan"}
            </Button>
          </form>

          {!isUserLoading && !isSignedIn ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 p-4">
              <p className="text-sm text-muted-foreground">
                Connect GitHub before starting a paid fix.
              </p>
              <Button onClick={loginWithGithub} variant="outline">
                <GitBranch className="size-4" />
                Connect GitHub
              </Button>
            </div>
          ) : null}

          {audit.startError ? (
            <p className="text-sm text-destructive">
              {audit.startError.message}
            </p>
          ) : null}

          {audit.isPolling ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Running scan. Larger sites can take a moment.
            </p>
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
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Ready for the paid fix</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedRepo
                  ? `Checkout will use ${selectedRepo.fullName} and this scan report.`
                  : "Choose a repository before checkout so the fix can open a PR."}
              </p>
              {checkout.error ? (
                <p className="mt-2 text-sm text-destructive">
                  {checkout.error.message}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {!isSignedIn ? (
                <Button onClick={loginWithGithub}>
                  <GitBranch className="size-4" />
                  Connect GitHub
                </Button>
              ) : selectedRepo ? (
                <Button
                  disabled={checkout.isPending}
                  onClick={onStartCheckout}
                >
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
              <Button asChild variant="outline">
                <Link href="/fix-agent">
                  Fix workspace
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </DashboardShell>
  )
}
