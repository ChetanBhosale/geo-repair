"use client"

import { Loader2 } from "lucide-react"
import type { FixRunSummary } from "@repo/types/fix"
import { stateLabel, stateVariant } from "@/lib/fix-run-view"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function RunHistory({
  error,
  isLoading,
  onSelectRun,
  runs,
  selectedRunId,
}: {
  error: Error | null
  isLoading: boolean
  onSelectRun: (runId: string) => void
  runs: FixRunSummary[]
  selectedRunId: string | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Run history</CardTitle>
        <CardDescription>
          Select a run to inspect its transcript and technical detail.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading runs
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive">{error.message}</p>
        ) : null}
        {!isLoading && runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fix runs yet.</p>
        ) : null}
        {runs.map((run) => (
          <button
            className={cn(
              "rounded-lg p-3 text-left transition-colors hover:bg-muted",
              selectedRunId === run.id && "bg-muted"
            )}
            key={run.id}
            onClick={() => onSelectRun(run.id)}
            type="button"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">
                {run.website}
              </span>
              <Badge variant={stateVariant(run.state)}>
                {stateLabel(run.state)}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {run.fixedChecks}/{run.totalChecks} checks fixed
            </p>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
