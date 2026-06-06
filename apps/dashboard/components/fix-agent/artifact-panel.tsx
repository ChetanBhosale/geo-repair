"use client"

import type { FixRunDetail } from "@repo/types/fix"
import { fixCheckStatusVariant } from "@/lib/dashboard-format"
import {
  artifactTabs,
  diffSummaryFromDetail,
  formatCostCents,
  formatRunDuration,
  type ArtifactTab,
} from "@/lib/fix-run-view"
import { DiffView } from "@/components/fix-agent/diff-view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function ArtifactPanel({
  detail,
  activeTab,
  onSelectTab,
}: {
  detail: FixRunDetail | null
  activeTab: ArtifactTab
  onSelectTab: (tab: ArtifactTab) => void
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 py-0">
      <div className="flex shrink-0 flex-wrap gap-2 border-b border-secondary p-3">
        {artifactTabs.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            size="sm"
            variant={activeTab === tab.id ? "secondary" : "ghost"}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      <CardContent className="min-h-0 flex-1 overflow-auto p-5">
        <PanelBody
          activeTab={activeTab}
          detail={detail}
          onSelectTab={onSelectTab}
        />
      </CardContent>
    </Card>
  )
}

function PanelBody({
  detail,
  activeTab,
  onSelectTab,
}: {
  detail: FixRunDetail | null
  activeTab: ArtifactTab
  onSelectTab: (tab: ArtifactTab) => void
}) {
  if (!detail) {
    return (
      <p className="text-sm text-secondary">
        Select a run to inspect its diff and checks.
      </p>
    )
  }

  if (activeTab === "diff") {
    return (
      <DiffView
        diff={diffSummaryFromDetail(detail)}
        onShowChecks={() => onSelectTab("checks")}
        prUrl={detail.prUrl}
      />
    )
  }

  if (activeTab === "cost") {
    return <CostPanel detail={detail} />
  }

  return <ChecksPanel detail={detail} />
}

function ChecksPanel({ detail }: { detail: FixRunDetail }) {
  const flagged = detail.checks.filter((check) => check.status === "FLAGGED")

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">
          {detail.fixedChecks}/{detail.totalChecks} fixed
        </span>
        {detail.pendingChecks ? (
          <Badge variant="partial">{detail.pendingChecks} pending</Badge>
        ) : null}
        {flagged.length ? (
          <Badge variant="neutral">{flagged.length} flagged</Badge>
        ) : null}
      </div>

      {detail.checks.length === 0 ? (
        <p className="text-sm text-secondary">
          No checks yet — the agent is still building the fix plan.
        </p>
      ) : null}

      <div className="grid gap-3">
        {detail.checks.map((check) => (
          <div className="rounded-lg bg-secondary/30 p-3.5" key={check.rubricId}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm">{check.rubricId}</span>
              <Badge variant={fixCheckStatusVariant(check.status)}>
                {check.status.toLowerCase()}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-secondary">
              {check.note ?? `${check.category || "check"} · ${check.scope}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function CostPanel({ detail }: { detail: FixRunDetail }) {
  const cogs = detail.cogs

  if (!cogs) {
    return (
      <p className="text-sm text-secondary">
        Internal cost data is only exposed in local development.
      </p>
    )
  }

  const rows = [
    ["Token cost", formatCostCents(cogs.tokenCostCents)],
    ["Sandbox cost", formatCostCents(cogs.sandboxCostCents)],
    ["Image cost", formatCostCents(cogs.imageCostCents)],
    ["Total", formatCostCents(cogs.totalCostCents)],
  ] as const

  const rawRows = [
    ["Model", cogs.model ?? "pending"],
    ["Input tokens", cogs.tokensIn.toLocaleString("en-US")],
    ["Output tokens", cogs.tokensOut.toLocaleString("en-US")],
    ["Sandbox time", formatRunDuration(cogs.sandboxSeconds)],
    ["Generated images", cogs.imageCount.toLocaleString("en-US")],
  ] as const

  return (
    <div className="grid gap-4">
      <div className="rounded-lg bg-secondary/30 p-4">
        <h3 className="text-sm font-semibold">Estimated run cost</h3>
        <div className="mt-3 grid gap-2">
          {rows.map(([label, value]) => (
            <div
              className="flex items-center justify-between gap-4 text-sm"
              key={label}
            >
              <span className="text-secondary">{label}</span>
              <span className="font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-secondary/30 p-4">
        <h3 className="text-sm font-semibold">Raw usage</h3>
        <div className="mt-3 grid gap-2">
          {rawRows.map(([label, value]) => (
            <div
              className="flex items-center justify-between gap-4 text-sm"
              key={label}
            >
              <span className="text-secondary">{label}</span>
              <span className="break-all text-right font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
