"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ClockIcon,
  CreditCardIcon,
  PlayIcon,
  RobotIcon,
  SpinnerGapIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import type {
  CheckStatus,
  ScrapingDetail,
  ScrapingStatus,
  ScrapingSummary,
  SiteCheck,
} from "@repo/types/scraping"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageLoader } from "@/components/page-loader"
import { ProjectFavicon } from "@/components/dashboard/project-favicon"
import { useWorkerStatus } from "@/context/worker-status"
import { useBreadcrumbs } from "@/context/breadcrumb"
import {
  useDeleteProject,
  useProject,
  useProjectScrapings,
  useScraping,
  useStartScan,
} from "@/query/project.query"
import {
  useCompleteRun,
  useProjectAgentRuns,
  useStartAgentPlan,
} from "@/query/agent.query"
import { useCreateFixCheckout } from "@/query/billing.query"
import type { AgentRunSummary } from "@repo/types/agent"

const CHECK_STYLES: Record<CheckStatus, string> = {
  SUCCESS: "bg-primary/10 text-primary",
  MID: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  FAILED: "bg-destructive/10 text-destructive",
  NOT_APPLICABLE: "bg-muted text-muted-foreground",
  INCONCLUSIVE: "bg-muted text-muted-foreground",
}

const RUN_STYLES: Record<ScrapingStatus, string> = {
  COMPLETED: "bg-primary/10 text-primary",
  RUNNING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  QUEUED: "bg-muted text-muted-foreground",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELED: "bg-muted text-muted-foreground",
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>()
  const projectId = params.projectId
  const router = useRouter()

  const project = useProject(projectId)
  const runs = useProjectScrapings(projectId)
  const startScan = useStartScan(projectId)
  const deleteProject = useDeleteProject()
  const live = useWorkerStatus(projectId)

  const agentRuns = useProjectAgentRuns(projectId)
  const startAgentPlan = useStartAgentPlan(projectId)
  const completeRun = useCompleteRun(projectId)
  const createCheckout = useCreateFixCheckout()
  // A planning worker is polling for this project.
  const agentRunning = live.workers.some((w) => w.service === "AGENT")
  // The agent fixes a completed scan, so only offer it once one exists.
  const hasCompletedScan = React.useMemo(
    () => (runs.data ?? []).some((r) => r.status === "COMPLETED"),
    [runs.data]
  )
  // The currently-open run (blocks starting a new one until it's merged/done).
  const openAgentRun = React.useMemo(
    () => (agentRuns.data ?? []).find((r) => r.isOpen) ?? null,
    [agentRuns.data]
  )
  const [completeConfirmOpen, setCompleteConfirmOpen] = React.useState(false)

  useBreadcrumbs([
    { label: "Projects", href: "/dashboard/projects" },
    { label: project.data?.name ?? "Project" },
  ])

  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const effectiveSelectedId = selectedId ?? runs.data?.[0]?.id ?? null
  const detail = useScraping(effectiveSelectedId)
  const data = detail.data ?? null
  const result = data?.result ?? null
  const isRunning = data?.status === "RUNNING" || data?.status === "QUEUED"
  // Cannot delete while any scan/job is in flight for this project.
  const busy = isRunning || live.hasActive

  async function onScan() {
    const created = await startScan.mutateAsync()
    setSelectedId(created.id)
  }

  async function startPaidAgentRun() {
    const checkout = await createCheckout.mutateAsync({ projectId })
    if (checkout.checkoutUrl) {
      window.location.assign(checkout.checkoutUrl)
      return
    }
    if (!checkout.order.startFixUnlocked) {
      toast.error("Payment is not confirmed yet.")
      return
    }

    const created = await startAgentPlan.mutateAsync(checkout.order.id)
    router.push(`/dashboard/projects/${projectId}/agent/${created.agentRunId}`)
  }

  async function onAgent() {
    if (openAgentRun) {
      router.push(`/dashboard/projects/${projectId}/agent/${openAgentRun.id}`)
      return
    }
    try {
      await startPaidAgentRun()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start the agent."
      )
    }
  }

  // Complete the open run, then immediately start a fresh one.
  async function onCompleteThenNew() {
    if (!openAgentRun) return
    try {
      await completeRun.mutateAsync(openAgentRun.id)
      setCompleteConfirmOpen(false)
      await startPaidAgentRun()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start a new run."
      )
    }
  }

  async function onDelete() {
    await deleteProject.mutateAsync(projectId)
    setConfirmOpen(false)
    router.push("/dashboard/projects")
  }

  if (project.isLoading) return <PageLoader />

  const runList = runs.data ?? []

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <ProjectFavicon
            src={project.data?.faviconUrl}
            className="size-9"
            imgClassName="size-5"
          />
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight">
              {project.data?.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              {project.data?.fullName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onScan}
            disabled={isRunning || startScan.isPending}
          >
            {isRunning || startScan.isPending ? (
              <SpinnerGapIcon className="size-4 animate-spin" />
            ) : (
              <PlayIcon className="size-4" />
            )}
            {isRunning ? "Scanning..." : "Run scan"}
          </Button>
          {hasCompletedScan ? (
            openAgentRun ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAgent}
                  disabled={startAgentPlan.isPending}
                >
                  {agentRunning ? (
                    <SpinnerGapIcon className="size-4 animate-spin" />
                  ) : (
                    <RobotIcon className="size-4" />
                  )}
                  {agentRunning ? "Agent running..." : "Resume agent"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCompleteConfirmOpen(true)}
                  disabled={completeRun.isPending || startAgentPlan.isPending}
                >
                  New run
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={onAgent}
                disabled={startAgentPlan.isPending || createCheckout.isPending}
              >
                {startAgentPlan.isPending || createCheckout.isPending ? (
                  <SpinnerGapIcon className="size-4 animate-spin" />
                ) : (
                  <CreditCardIcon className="size-4" />
                )}
                Buy fix
              </Button>
            )
          ) : null}
          <Button
            variant="outline"
            size="icon"
            aria-label="Delete project"
            disabled={busy || deleteProject.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <TrashIcon className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project and all of its scans and logs. You can
              add the repository again later. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteProject.isError ? (
            <p className="text-sm text-destructive">
              {(deleteProject.error as Error).message}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProject.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void onDelete()
              }}
              disabled={deleteProject.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteProject.isPending ? "Deleting..." : "Delete project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete-current-run confirm (to start a new one) */}
      <AlertDialog
        open={completeConfirmOpen}
        onOpenChange={setCompleteConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete the current agent run?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an open agent run. Mark it complete (e.g. its PR is
              merged or no longer needed) to start a fresh run. This closes the
              current run and its chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={
                completeRun.isPending ||
                startAgentPlan.isPending ||
                createCheckout.isPending
              }
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void onCompleteThenNew()
              }}
              disabled={
                completeRun.isPending ||
                startAgentPlan.isPending ||
                createCheckout.isPending
              }
            >
              {completeRun.isPending ||
              startAgentPlan.isPending ||
              createCheckout.isPending
                ? "Starting..."
                : "Complete & start new"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Agent runs history */}
      {(agentRuns.data?.length ?? 0) > 0 ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">Agent runs</h2>
          </div>
          <div>
            {(agentRuns.data ?? []).map((run, i) => (
              <AgentRunRow
                key={run.id}
                run={run}
                first={i === 0}
                onOpen={() =>
                  router.push(
                    `/dashboard/projects/${projectId}/agent/${run.id}`
                  )
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Details card (Vercel-style) */}
      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-medium">Scan details</h2>
          {runList.length > 0 ? (
            <Select
              value={effectiveSelectedId ?? undefined}
              onValueChange={setSelectedId}
            >
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue placeholder="Select a run" />
              </SelectTrigger>
              <SelectContent>
                {runList.map((run) => (
                  <RunOption key={run.id} run={run} />
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {!data ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            {runList.length === 0
              ? "No scans yet. Run a scan to check this site against the rubric."
              : "Select a run to view its result."}
          </div>
        ) : (
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Meta label="Status">
              <RunBadge status={data.status} />
            </Meta>
            <Meta label="Score">
              {result ? (
                <span className="text-base font-semibold">
                  {result.score.overall}
                  <span className="text-xs font-normal text-muted-foreground">
                    {" "}
                    / 100
                  </span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">--</span>
              )}
            </Meta>
            <Meta label="Pages checked">
              <span className="text-sm">{data.pagesChecked || "--"}</span>
            </Meta>
            <Meta label="Started">
              <span className="inline-flex items-center gap-1 text-sm">
                <ClockIcon className="size-3.5 text-muted-foreground" />
                {timeAgo(data.createdAt)}
              </span>
            </Meta>
          </div>
        )}

        {data?.error ? (
          <div className="border-t border-border bg-destructive/5 px-5 py-3 text-sm text-destructive">
            {data.error}
          </div>
        ) : null}

        {isRunning ? (
          <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-sm text-muted-foreground">
            <SpinnerGapIcon className="size-4 animate-spin" />
            Scanning {data?.websiteUrl}... this view updates automatically.
          </div>
        ) : null}
      </div>

      {/* Category strip */}
      {result ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries(result.score.byCategory).map(([cat, v]) => (
            <div
              key={cat}
              className="rounded-lg border border-border bg-card p-3"
            >
              <p
                className="truncate text-[11px] text-muted-foreground"
                title={cat}
              >
                {cat}
              </p>
              <p className="mt-0.5 text-lg font-semibold">
                {v.status === "NOT_APPLICABLE" ? "n/a" : v.score}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Collapsible sections */}
      {data ? (
        <Accordion
          type="multiple"
          defaultValue={["logs", "checks"]}
          className="mt-5 space-y-2"
        >
          <Section value="logs" title="Activity logs" count={data.logs.length}>
            <LogStream detail={data} />
          </Section>

          {result ? (
            <Section value="checks" title="Checks" count={result.checks.length}>
              <div className="space-y-2 pt-1">
                {result.checks.map((c) => (
                  <CheckRow key={c.name} check={c} />
                ))}
              </div>
            </Section>
          ) : null}

          {result && result.notes.length > 0 ? (
            <Section
              value="recommendations"
              title="Recommendations"
              count={result.notes.length}
            >
              <ul className="space-y-1.5 pt-1 text-sm text-muted-foreground">
                {result.notes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </Accordion>
      ) : null}
    </div>
  )
}

function AgentRunRow({
  run,
  first,
  onOpen,
}: {
  run: AgentRunSummary
  first: boolean
  onOpen: () => void
}) {
  const label = run.prMerged
    ? "merged"
    : run.isOpen
      ? run.status.replace("_", " ").toLowerCase()
      : run.status.toLowerCase()
  const style = run.prMerged
    ? "bg-primary/10 text-primary"
    : run.isOpen
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : run.status === "FAILED"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground"
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40",
        !first && "border-t border-border"
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              style
            )}
          >
            {label}
          </span>
          {run.isOpen ? (
            <span className="text-[11px] text-muted-foreground">active</span>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {timeAgo(run.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/70">
          {run.id}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
        {run.prUrl ? <span className="text-primary">PR</span> : null}
        {run.scoreBefore != null ? (
          <span>
            {run.scoreBefore}
            {run.scoreAfter != null ? ` -> ${run.scoreAfter}` : ""}
          </span>
        ) : null}
      </div>
    </button>
  )
}

function RunOption({ run }: { run: ScrapingSummary }) {
  return (
    <SelectItem value={run.id}>
      <span className="inline-flex items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground uppercase">
          {run.status.toLowerCase()}
        </span>
        <span>{timeAgo(run.createdAt)}</span>
        {run.score != null ? (
          <span className="text-muted-foreground">· {run.score}</span>
        ) : null}
      </span>
    </SelectItem>
  )
}

function Meta({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function RunBadge({ status }: { status: ScrapingStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        RUN_STYLES[status]
      )}
    >
      {status.toLowerCase()}
    </span>
  )
}

function StatusPill({ status }: { status: CheckStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        CHECK_STYLES[status]
      )}
    >
      {status.replace("_", " ").toLowerCase()}
    </span>
  )
}

function Section({
  value,
  title,
  count,
  children,
}: {
  value: string
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <AccordionItem
      value={value}
      className="overflow-hidden rounded-xl border border-border bg-card px-4"
    >
      <AccordionTrigger className="py-3.5 hover:no-underline">
        <span className="flex items-center gap-2 text-sm font-medium">
          {title}
          {count != null ? (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {count}
            </span>
          ) : null}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-4">{children}</AccordionContent>
    </AccordionItem>
  )
}

function LogStream({ detail }: { detail: ScrapingDetail }) {
  if (detail.logs.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">No activity yet.</p>
    )
  }
  return (
    <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg bg-background/60 p-3 font-mono text-xs">
      {detail.logs.map((l) => (
        <div key={l.seq} className="flex gap-2">
          <span className="shrink-0 text-muted-foreground/60">
            {String(l.seq).padStart(3, "0")}
          </span>
          <span
            className={cn(
              "shrink-0",
              l.level === "error"
                ? "text-destructive"
                : l.level === "warn"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-primary/70"
            )}
          >
            [{l.event}]
          </span>
          <span className="text-foreground/80">{l.message}</span>
        </div>
      ))}
    </div>
  )
}

function CheckRow({ check }: { check: SiteCheck }) {
  const [open, setOpen] = React.useState(false)
  const hasAffected = check.affectedPages.length > 0
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => hasAffected && setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left",
          hasAffected && "cursor-pointer"
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{check.name}</span>
            <StatusPill status={check.status} />
            {hasAffected ? (
              <span className="text-[11px] text-muted-foreground">
                {check.affectedPages.length} affected
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {check.summary}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {check.status === "NOT_APPLICABLE"
            ? "n/a"
            : `${check.pointsEarned}/${check.pointsPossible}`}
        </span>
      </button>
      {open && hasAffected ? (
        <div className="space-y-2 border-t border-border px-4 py-3">
          {check.affectedPages.map((p, i) => (
            <div key={i} className="text-xs">
              <p className="truncate font-medium text-foreground/80">
                {p.page}
              </p>
              <p className="text-muted-foreground">{p.issue}</p>
              {p.recommendation ? (
                <p className="mt-0.5 text-primary">{p.recommendation}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
