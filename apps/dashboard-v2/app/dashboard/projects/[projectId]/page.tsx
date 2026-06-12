"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
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
import { ProjectFavicon } from "@/components/dashboard/project-favicon"
import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { FixPlanDialog } from "@/components/dashboard/fix-plan-dialog"
import {
  CategoryScoreRows,
  ScoreBlockStrip,
  ScoreSummary,
  type ScoreCategoryRow,
} from "@/components/dashboard/score-block-strip"
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
import {
  useBillingOrder,
  useCreateFixCheckout,
  useReconcileBillingOrder,
} from "@/query/billing.query"
import type { AgentRunSummary } from "@repo/types/agent"
import type { FixTier } from "@repo/types/billing"

const CHECK_STYLES: Record<CheckStatus, string> = {
  SUCCESS: "bg-success/10 text-success",
  MID: "bg-warning/15 text-warning",
  FAILED: "bg-destructive/10 text-destructive",
  NOT_APPLICABLE: "bg-muted text-muted-foreground",
  INCONCLUSIVE: "bg-muted text-muted-foreground",
}

const RUN_STYLES: Record<ScrapingStatus, string> = {
  COMPLETED: "bg-success/10 text-success",
  RUNNING: "bg-warning/15 text-warning",
  QUEUED: "bg-muted text-muted-foreground",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELED: "bg-muted text-muted-foreground",
}

const RUBRIC_CATEGORY_ORDER = [
  "Rendering",
  "Structured data",
  "Metadata",
  "Crawl surface",
  "Semantics",
  "Content",
  "Answerability",
] as const

function selectedRunStorageKey(projectId: string): string {
  return `geo-repair.dashboard.selected-run.${projectId}`
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
  const searchParams = useSearchParams()
  const checkoutReturnOrderId = searchParams.get("order_id")
  const checkoutReturnPaymentId = searchParams.get("payment_id")
  const checkoutReturnStatus = searchParams.get("status")
  const shouldStartReturnedFix = searchParams.get("start_fix") === "1"

  const project = useProject(projectId)
  const runs = useProjectScrapings(projectId)
  const startScan = useStartScan(projectId)
  const deleteProject = useDeleteProject()
  const live = useWorkerStatus(projectId)

  const agentRuns = useProjectAgentRuns(projectId)
  const startAgentPlan = useStartAgentPlan(projectId)
  const completeRun = useCompleteRun(projectId)
  const createCheckout = useCreateFixCheckout()
  const returnedOrder = useBillingOrder(
    shouldStartReturnedFix ? checkoutReturnOrderId : null
  )
  const reconcileReturnedOrder = useReconcileBillingOrder()
  // A planning worker is polling for this project.
  const agentRunning = live.workers.some((w) => w.service === "AGENT")
  const latestCompletedScan = React.useMemo(
    () => (runs.data ?? []).find((run) => run.status === "COMPLETED") ?? null,
    [runs.data]
  )
  const checkoutPageCount = Math.max(1, latestCompletedScan?.pagesChecked || 25)
  // The agent fixes a completed scan, so only offer it once one exists.
  const hasCompletedScan = !!latestCompletedScan
  // The currently-open run (blocks starting a new one until it's merged/done).
  const openAgentRun = React.useMemo(
    () => (agentRuns.data ?? []).find((r) => r.isOpen) ?? null,
    [agentRuns.data]
  )
  const [completeConfirmOpen, setCompleteConfirmOpen] = React.useState(false)
  const [planDialogOpen, setPlanDialogOpen] = React.useState(false)
  const autoReconciledOrderRef = React.useRef<string | null>(null)
  const startRequestedOrderRef = React.useRef<string | null>(null)

  useBreadcrumbs([
    { label: "Projects", href: "/dashboard/projects" },
    { label: project.data?.name ?? "Project" },
  ])

  const [selectedId, setSelectedIdState] = React.useState<string | null>(null)
  const setSelectedId = React.useCallback(
    (id: string | null) => {
      setSelectedIdState(id)
      if (typeof window === "undefined") return
      const key = selectedRunStorageKey(projectId)
      if (id) window.sessionStorage.setItem(key, id)
      else window.sessionStorage.removeItem(key)
    },
    [projectId]
  )
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [paymentConfirmOpen, setPaymentConfirmOpen] = React.useState(false)

  React.useEffect(() => {
    const stored = window.sessionStorage.getItem(selectedRunStorageKey(projectId))
    if (!stored) return

    const timeout = window.setTimeout(() => setSelectedIdState(stored), 0)
    return () => window.clearTimeout(timeout)
  }, [projectId])

  const clearCheckoutReturnParams = React.useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("order_id")
    nextParams.delete("payment_id")
    nextParams.delete("status")
    nextParams.delete("start_fix")

    const nextQuery = nextParams.toString()
    router.replace(
      `/dashboard/projects/${projectId}${nextQuery ? `?${nextQuery}` : ""}`
    )
  }, [projectId, router, searchParams])

  const selectedIdExists = !!selectedId && runs.data?.some((run) => run.id === selectedId)
  const effectiveSelectedId = selectedIdExists
    ? selectedId
    : (runs.data?.[0]?.id ?? null)
  const detail = useScraping(effectiveSelectedId)
  const data = detail.data ?? null
  const result = data?.result ?? null
  const categoryRows = React.useMemo<ScoreCategoryRow[]>(() => {
    if (!result) return []

    const grouped = new Map<string, SiteCheck[]>()
    for (const check of result.checks) {
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
      const checks = (grouped.get(category) ?? []).sort(
        (a, b) => b.weight - a.weight
      )
      const sub = result.score.byCategory[category]
      return {
        category,
        score:
          sub && sub.status !== "NOT_APPLICABLE" ? Math.round(sub.score) : null,
        status: sub?.status ?? "INCONCLUSIVE",
        checks,
      }
    })
  }, [result])
  const isRunning = data?.status === "RUNNING" || data?.status === "QUEUED"
  // Cannot delete while any scan/job is in flight for this project.
  const busy = isRunning || live.hasActive

  React.useEffect(() => {
    if (
      !shouldStartReturnedFix ||
      !checkoutReturnOrderId ||
      !checkoutReturnPaymentId ||
      checkoutReturnStatus !== "succeeded" ||
      autoReconciledOrderRef.current === checkoutReturnOrderId
    ) {
      return
    }

    autoReconciledOrderRef.current = checkoutReturnOrderId
    void reconcileReturnedOrder
      .mutateAsync({
        orderId: checkoutReturnOrderId,
        paymentId: checkoutReturnPaymentId,
        status: checkoutReturnStatus,
      })
      .catch((err) => {
        toast.error(
          err instanceof Error
            ? err.message
            : "Payment was received, but the order could not be verified."
        )
      })
  }, [
    checkoutReturnOrderId,
    checkoutReturnPaymentId,
    checkoutReturnStatus,
    reconcileReturnedOrder,
    shouldStartReturnedFix,
  ])

  React.useEffect(() => {
    if (!shouldStartReturnedFix || !checkoutReturnOrderId) return
    if (returnedOrder.isLoading || reconcileReturnedOrder.isPending) return

    const order = returnedOrder.data
    if (!order) return

    if (order.projectId && order.projectId !== projectId) {
      toast.error("This payment belongs to a different project.")
      clearCheckoutReturnParams()
      return
    }

    if (["FAILED", "CANCELED", "REFUNDED", "DISPUTED"].includes(order.status)) {
      toast.error("Payment was not completed.")
      clearCheckoutReturnParams()
      return
    }

    if (!order.startFixUnlocked) return

    const timeout = window.setTimeout(() => setPaymentConfirmOpen(true), 0)
    return () => window.clearTimeout(timeout)
  }, [
    checkoutReturnOrderId,
    clearCheckoutReturnParams,
    projectId,
    reconcileReturnedOrder.isPending,
    returnedOrder.data,
    returnedOrder.isLoading,
    shouldStartReturnedFix,
  ])

  async function onConfirmPaidStart() {
    if (openAgentRun) {
      router.push(`/dashboard/projects/${projectId}/agent/${openAgentRun.id}`)
      return
    }

    const order = returnedOrder.data
    if (!order?.startFixUnlocked) {
      toast.error("Payment is not confirmed yet.")
      return
    }

    if (startRequestedOrderRef.current === order.id) return

    try {
      startRequestedOrderRef.current = order.id
      const created = await startAgentPlan.mutateAsync(order.id)
      setPaymentConfirmOpen(false)
      router.push(`/dashboard/projects/${projectId}/agent/${created.agentRunId}`)
    } catch (err) {
      startRequestedOrderRef.current = null
      toast.error(err instanceof Error ? err.message : "Could not start the fix.")
    }
  }

  function onPaymentConfirmOpenChange(open: boolean) {
    setPaymentConfirmOpen(open)
    if (!open) clearCheckoutReturnParams()
  }

  async function onScan() {
    const created = await startScan.mutateAsync()
    setSelectedId(created.id)
  }

  async function startPaidAgentRun(selectedTier: FixTier) {
    const checkout = await createCheckout.mutateAsync({
      projectId,
      selectedTier,
    })
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

  async function onPlanContinue(selectedTier: FixTier) {
    try {
      await startPaidAgentRun(selectedTier)
      setPlanDialogOpen(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start the checkout."
      )
    }
  }

  async function onAgent() {
    if (openAgentRun) {
      router.push(`/dashboard/projects/${projectId}/agent/${openAgentRun.id}`)
      return
    }
    setPlanDialogOpen(true)
  }

  // Complete the open run, then immediately start a fresh one.
  async function onCompleteThenNew() {
    if (!openAgentRun) return
    try {
      await completeRun.mutateAsync(openAgentRun.id)
      setCompleteConfirmOpen(false)
      setPlanDialogOpen(true)
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

  if (project.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <DashboardInlineLoading rows={4} />
      </div>
    )
  }

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
                Buy now
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

      <FixPlanDialog
        open={planDialogOpen}
        pageCount={checkoutPageCount}
        pending={createCheckout.isPending || startAgentPlan.isPending}
        onOpenChange={setPlanDialogOpen}
        onContinue={(tier) => void onPlanContinue(tier)}
      />

      <AlertDialog
        open={paymentConfirmOpen}
        onOpenChange={onPaymentConfirmOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Payment confirmed</AlertDialogTitle>
            <AlertDialogDescription>
              {openAgentRun
                ? "An agent run is already active for this project."
                : "Start the fix agent for this project now?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={startAgentPlan.isPending}>
              Not now
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void onConfirmPaidStart()
              }}
              disabled={startAgentPlan.isPending}
            >
              {startAgentPlan.isPending
                ? "Starting..."
                : openAgentRun
                  ? "Open agent run"
                  : "Start fix"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

        {result ? (
          <div className="border-t border-border bg-card px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                Score
              </p>
              <ScoreSummary score={result.score.overall} />
            </div>
            <ScoreBlockStrip
              score={result.score.overall}
              className="mt-3"
              barClassName="h-8"
            />
          </div>
        ) : null}

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
      {categoryRows.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl bg-border">
          <CategoryScoreRows rows={categoryRows} />
        </div>
      ) : null}

      {/* Collapsible sections */}
      {data ? (
        <Accordion
          type="multiple"
          defaultValue={["checks", "recommendations"]}
          className="mt-5 space-y-2"
        >
          {result ? (
            <Section
              value="checks"
              title="Checks"
              count={result.checks.length}
              contentClassName="pb-2"
            >
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
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
              compact
            >
              <ul className="space-y-1.5 text-sm text-muted-foreground">
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
    ? "bg-success/10 text-success"
    : run.isOpen
      ? "bg-warning/15 text-warning"
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
  compact = false,
  contentClassName,
  children,
}: {
  value: string
  title: string
  count?: number
  compact?: boolean
  contentClassName?: string
  children: React.ReactNode
}) {
  return (
    <AccordionItem
      value={value}
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        compact ? "px-3" : "px-4"
      )}
    >
      <AccordionTrigger
        className={cn(
          "hover:no-underline",
          compact ? "py-2.5" : "py-3.5"
        )}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          {title}
          {count != null ? (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {count}
            </span>
          ) : null}
        </span>
      </AccordionTrigger>
      <AccordionContent
        className={cn(compact ? "pb-2" : "pb-4", contentClassName)}
      >
        {children}
      </AccordionContent>
    </AccordionItem>
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
