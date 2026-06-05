"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import {
  ArrowRight,
  GitBranch,
  Loader2,
  ScanSearch,
  Settings,
  Wrench,
} from "lucide-react"
import { loginWithGithub, useUser } from "@/hooks/use-auth"
import { useFixRuns } from "@/hooks/use-fix"
import { useSavedRepos } from "@/hooks/use-repos"
import { DashboardShell } from "@/components/dashboard-shell"
import { StatePanel } from "@/components/state-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function formatState(value: string) {
  return value.replaceAll("_", " ").toLowerCase()
}

export default function DashboardHomePage() {
  const { isLoading, isSignedIn } = useUser()
  const savedRepos = useSavedRepos(isSignedIn)
  const runs = useFixRuns(isSignedIn)
  const repositories = savedRepos.data ?? []
  const selectedRepo =
    repositories.find((repository) => repository.selected) ??
    repositories[0] ??
    null
  const latestRun = runs.data?.[0] ?? null
  const activeRun = runs.data?.find((run) =>
    [
      "QUEUED",
      "SCANNING",
      "CLONING",
      "FIXING",
      "VERIFYING",
      "PUSHING",
    ].includes(run.state)
  )

  return (
    <DashboardShell eyebrow="Dashboard" title="Project command center">
      {isLoading ? (
        <StatePanel
          eyebrow="Loading"
          title="Loading your dashboard"
          description="We are checking your session and project access."
          action={
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          }
        />
      ) : null}

      {!isLoading && !isSignedIn ? (
        <StatePanel
          eyebrow="GitHub required"
          title="Connect GitHub to create your first project"
          description="The dashboard starts after GitHub auth because fixes are scoped to the repository you choose."
          action={
            <Button onClick={loginWithGithub}>
              <GitBranch className="size-4" />
              Continue with GitHub
            </Button>
          }
        />
      ) : null}

      {isSignedIn && savedRepos.isLoading ? (
        <StatePanel
          eyebrow="Loading"
          title="Loading repositories"
          description="We are checking which project should be active."
          action={
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          }
        />
      ) : null}

      {isSignedIn && savedRepos.isError ? (
        <StatePanel
          eyebrow="Repository error"
          title="Could not load saved repositories"
          description={(savedRepos.error as Error).message}
          tone="danger"
          action={
            <Button asChild variant="outline">
              <Link href="/settings">Open settings</Link>
            </Button>
          }
        />
      ) : null}

      {isSignedIn && !savedRepos.isLoading && repositories.length === 0 ? (
        <StatePanel
          eyebrow="No projects"
          title="Choose the repository that builds your site"
          description="A project is created around one website and one GitHub repo. After that, scans, fixes, runs, reports, and settings stay attached to it."
          action={
            <Button asChild>
              <Link href="/settings">
                <GitBranch className="size-4" />
                Choose repository
              </Link>
            </Button>
          }
        />
      ) : null}

      {isSignedIn && selectedRepo ? (
        <>
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted">{selectedRepo.defaultBranch}</Badge>
                  {activeRun ? (
                    <Badge>{formatState(activeRun.state)}</Badge>
                  ) : null}
                  {latestRun?.prUrl ? (
                    <Badge variant="pass">PR opened</Badge>
                  ) : null}
                </div>
                <CardTitle className="text-2xl">
                  {selectedRepo.fullName}
                </CardTitle>
                <CardDescription>
                  Active project for repo-scoped scans, fixes, PRs, and reports.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Fix runs"
                  value={String(runs.data?.length ?? 0)}
                  detail="Across this account"
                />
                <Metric
                  label="Latest state"
                  value={latestRun ? formatState(latestRun.state) : "no runs"}
                  detail={latestRun?.website ?? "Start with a website scan"}
                />
                <Metric
                  label="Checks fixed"
                  value={
                    latestRun
                      ? `${latestRun.fixedChecks}/${latestRun.totalChecks}`
                      : "0/0"
                  }
                  detail="Latest fix run"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next action</CardTitle>
                <CardDescription>
                  Route to the surface that owns the work.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <ActionLink
                  href={activeRun ? "/fix-agent" : "/website-scan"}
                  icon={<Wrench className="size-4" />}
                  label={activeRun ? "Watch active fix" : "Run website scan"}
                />
                <ActionLink
                  href="/reports"
                  icon={<ScanSearch className="size-4" />}
                  label="View reports"
                />
                <ActionLink
                  href="/settings"
                  icon={<Settings className="size-4" />}
                  label="Manage project"
                />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <InsightCard
              title="Website scan"
              description="Run or review the scan before starting a fix."
              href="/website-scan"
            />
            <InsightCard
              title="Fix agent"
              description="Follow the run transcript, commands, checks, and PR result."
              href="/fix-agent"
            />
            <InsightCard
              title="Reports"
              description="Review scan, fix summary, before-after, and export states."
              href="/reports"
            />
          </section>
        </>
      ) : null}
    </DashboardShell>
  )
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/25 p-4">
      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-2 truncate text-lg font-semibold">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function ActionLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: ReactNode
  label: string
}) {
  return (
    <Button asChild className="justify-between" variant="outline">
      <Link href={href}>
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
        </span>
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  )
}

function InsightCard({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      className="rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/50"
      href={href}
    >
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </Link>
  )
}
