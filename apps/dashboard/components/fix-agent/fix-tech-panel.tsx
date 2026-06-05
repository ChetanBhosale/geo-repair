"use client"

import type { FixRunDetail, RunEventView } from "@repo/types/fix"
import { fixCheckStatusVariant } from "@/lib/dashboard-format"
import {
  commandFromEvent,
  diffPayloadFromDetail,
  eventBody,
  eventPayload,
  techTabs,
  type TechTab,
} from "@/lib/fix-run-view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function FixTechPanel({
  activeTab,
  detail,
  onActiveTabChange,
}: {
  activeTab: TechTab
  detail: FixRunDetail | null
  onActiveTabChange: (tab: TechTab) => void
}) {
  return (
    <Card className="min-h-0 overflow-hidden py-0">
      <div className="flex flex-wrap gap-2 border-b border-border p-3">
        {techTabs.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => onActiveTabChange(tab.id)}
            size="sm"
            variant={activeTab === tab.id ? "secondary" : "ghost"}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      <CardContent className="max-h-[608px] overflow-auto p-4">
        <TechPanel activeTab={activeTab} detail={detail} />
      </CardContent>
    </Card>
  )
}

function TechPanel({
  activeTab,
  detail,
}: {
  activeTab: TechTab
  detail: FixRunDetail | null
}) {
  if (!detail) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a run to inspect technical detail.
      </p>
    )
  }

  if (activeTab === "diff") {
    const { diffEvent, nameStatus, patch, stat } = diffPayloadFromDetail(detail)

    if (diffEvent) {
      return (
        <div className="grid gap-3">
          <div className="rounded-lg border border-border p-3">
            <h3 className="text-sm font-semibold">Changed files</h3>
            <pre className="mt-3 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-6">
              {nameStatus || "No changed files recorded."}
            </pre>
          </div>
          <div className="rounded-lg border border-border p-3">
            <h3 className="text-sm font-semibold">Diff stat</h3>
            <pre className="mt-3 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-6">
              {stat || "No diff stat recorded."}
            </pre>
          </div>
          <div className="rounded-lg border border-border p-3">
            <h3 className="text-sm font-semibold">Patch preview</h3>
            <pre className="mt-3 max-h-[420px] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-6">
              {patch || "No patch preview recorded."}
            </pre>
          </div>
        </div>
      )
    }

    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          The code diff appears here after the agent creates a commit. Until
          then, this tab shows the planned checks.
        </p>
        {detail.checks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checks yet.</p>
        ) : null}
        {detail.checks.map((check) => (
          <div
            className="rounded-lg border border-border p-3"
            key={check.rubricId}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-sm">{check.rubricId}</span>
              <Badge variant={fixCheckStatusVariant(check.status)}>
                {check.status.toLowerCase()}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {check.note ?? `${check.category} check, ${check.scope}`}
            </p>
          </div>
        ))}
      </div>
    )
  }

  if (activeTab === "console") {
    return <EventList events={detail.events} />
  }

  if (activeTab === "logs") {
    return (
      <pre className="overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-6">
        {JSON.stringify(detail.events, null, 2)}
      </pre>
    )
  }

  return <TerminalPanel detail={detail} events={detail.events} />
}

export function EventList({ events }: { events: RunEventView[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No events yet.</p>
  }

  return (
    <div className="grid gap-2">
      {events.map((event) => (
        <div
          className="grid grid-cols-[52px_120px_minmax(0,1fr)] gap-3 border-b border-border py-2 text-sm"
          key={event.seq}
        >
          <span className="font-mono text-xs text-muted-foreground">
            #{event.seq}
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {event.phase ?? "event"}
          </span>
          <span className="truncate">{event.type}</span>
        </div>
      ))}
    </div>
  )
}

export function TerminalPanel({
  detail,
  events,
}: {
  detail: FixRunDetail
  events: RunEventView[]
}) {
  const commandEvents = events.filter((event) => {
    const command = commandFromEvent(event)
    const payload = eventPayload(event)
    return (
      !!command ||
      payload.toolName === "run_command" ||
      event.type === "branch_pushed" ||
      event.type.includes("push")
    )
  })

  return (
    <div className="grid gap-3">
      <pre className="overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-6">
        {`run=${detail.id}
state=${detail.state}
sandbox=${detail.sandboxStatus}
branch=${detail.branch ?? "pending"}
pr=${detail.prUrl ?? "pending"}
fixed=${detail.fixedChecks}/${detail.totalChecks}`}
      </pre>

      {commandEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Terminal commands will stream here when the agent emits tool-call
          events.
        </p>
      ) : null}

      {commandEvents.map((event) => {
        const payload = eventPayload(event)
        const command = commandFromEvent(event)
        const output =
          typeof payload.content === "string"
            ? payload.content
            : typeof payload.detail === "string"
              ? payload.detail
              : null

        return (
          <div className="rounded-lg border border-border p-3" key={event.seq}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                #{event.seq}
              </span>
              <Badge variant="muted">{event.type}</Badge>
            </div>
            <pre className="mt-3 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-6">
              {command ? `$ ${command}` : eventBody(event)}
              {output ? `\n\n${output}` : ""}
            </pre>
          </div>
        )
      })}
    </div>
  )
}
