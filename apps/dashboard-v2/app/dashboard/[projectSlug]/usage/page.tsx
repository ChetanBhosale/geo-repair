"use client"

import { useParams } from "next/navigation"

import { DashboardInlineLoading } from "@/components/dashboard/inline-loading"
import { PageHeader } from "@/components/dashboard/page-header"
import { useBillingHistory } from "@/query/billing.query"
import { useProjectAgentRuns } from "@/query/agent.query"
import { useProjectBySlug, useProjectScrapings } from "@/query/project.query"

function formatPrice(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountCents / 100)
}

function formatCredits(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return value.toLocaleString()
}

export default function ProjectUsagePage() {
  const params = useParams<{ projectSlug: string }>()
  const project = useProjectBySlug(params.projectSlug)
  const billing = useBillingHistory()
  const scans = useProjectScrapings(project.data?.id ?? "", !!project.data)
  const agentRuns = useProjectAgentRuns(project.data?.id ?? "", !!project.data)

  if (project.isLoading || billing.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <DashboardInlineLoading rows={4} />
      </div>
    )
  }

  if (!project.data) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">
        Project not found.
      </div>
    )
  }

  const projectOrders = (billing.data?.orders ?? []).filter(
    (order) => order.projectId === project.data!.id
  )
  const aiCreditsLeft = (agentRuns.data ?? []).reduce(
    (sum, run) => sum + run.aiCreditsLeft,
    0
  )

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <PageHeader
        title="Usage"
        description={`Billing and credits for ${project.data.name}.`}
      />

      <div className="mt-5 grid gap-2 bg-secondary p-2 sm:grid-cols-3">
        <Metric label="Scans" value={(scans.data?.length ?? 0).toString()} />
        <Metric label="Fix threads" value={(agentRuns.data?.length ?? 0).toString()} />
        <Metric label="AI credits" value={formatCredits(aiCreditsLeft)} />
      </div>

      <div className="mt-5 bg-card">
        {projectOrders.length > 0 ? (
          projectOrders.map((order) => (
            <div
              key={order.id}
              className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[1fr_auto_auto]"
            >
              <div>
                <p className="font-medium">{order.website}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {order.repoFullName ?? project.data!.fullName}
                </p>
              </div>
              <p className="text-muted-foreground">
                {formatPrice(order.amountCents, order.currency)}
              </p>
              <p className="text-xs text-muted-foreground">{order.status}</p>
            </div>
          ))
        ) : (
          <div className="px-5 py-10 text-sm text-muted-foreground">
            No orders for this project yet.
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}
