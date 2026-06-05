"use client";

import * as React from "react";
import { Loader2, ExternalLink, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import type { FixRunState, FixCheckStatus } from "@repo/types/fix";
import { useFixRuns, useFixRun } from "@/hooks/use-fix";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACTIVE_STATES: FixRunState[] = [
  "QUEUED",
  "SCANNING",
  "CLONING",
  "FIXING",
  "VERIFYING",
  "PUSHING",
];

function stateLabel(state: FixRunState): string {
  return state.replace(/_/g, " ").toLowerCase();
}

function stateBadge(state: FixRunState) {
  if (state === "COMPLETED" || state === "PR_OPENED") return "pass" as const;
  if (state === "FAILED") return "fail" as const;
  return "default" as const;
}

function checkBadge(status: FixCheckStatus) {
  if (status === "FIXED") return "pass" as const;
  if (status === "FAILED") return "fail" as const;
  if (status === "FIXING") return "default" as const;
  return "muted" as const;
}

export function FixRuns() {
  const { data: runs, isLoading } = useFixRuns();
  const [openId, setOpenId] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading runs…
      </p>
    );
  }

  if (!runs || runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No fix runs yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {runs.map((run) => {
        const active = ACTIVE_STATES.includes(run.state);
        const isOpen = openId === run.id;
        return (
          <div key={run.id} className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : run.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{run.repoFullName}</span>
                  <Badge variant={stateBadge(run.state)}>
                    {active ? <Loader2 className="size-3 animate-spin" /> : null}
                    {stateLabel(run.state)}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {run.website} · {run.fixedChecks}/{run.totalChecks} checks fixed
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {run.prUrl ? (
                  <a
                    href={run.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    View PR <ExternalLink className="size-3" />
                  </a>
                ) : null}
                <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
              </div>
            </button>

            {isOpen ? <RunDetail id={run.id} /> : null}
          </div>
        );
      })}
    </div>
  );
}

function RunDetail({ id }: { id: string }) {
  const { data: detail, isLoading } = useFixRun(id);

  if (isLoading || !detail) {
    return (
      <div className="border-t border-border px-4 py-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
      {detail.error ? (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <XCircle className="size-4" />
          {detail.error}
        </p>
      ) : null}

      {/* Checks */}
      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Checks ({detail.fixedChecks}/{detail.totalChecks} fixed)
        </h4>
        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          {detail.checks.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No checks yet.</p>
          ) : (
            detail.checks.map((c) => (
              <div key={c.rubricId} className="flex items-start justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {c.fixed ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                    ) : null}
                    <span className="font-mono text-sm">{c.rubricId}</span>
                    <span className="text-xs text-muted-foreground">{c.scope}</span>
                  </div>
                  {c.note ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>
                  ) : null}
                </div>
                <Badge variant={checkBadge(c.status)}>{c.status.toLowerCase()}</Badge>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Event log */}
      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Activity log
        </h4>
        <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-xs">
          {detail.events.length === 0 ? (
            <p className="text-muted-foreground">No events yet.</p>
          ) : (
            detail.events.map((e) => (
              <div key={e.seq} className="py-0.5">
                <span className="text-muted-foreground">#{e.seq}</span> {e.type}
                {e.phase ? <span className="text-muted-foreground"> ({e.phase})</span> : null}
              </div>
            ))
          )}
        </div>
      </div>

      {detail.prUrl ? (
        <Button asChild variant="outline" className="w-fit">
          <a href={detail.prUrl} target="_blank" rel="noreferrer">
            View pull request <ExternalLink />
          </a>
        </Button>
      ) : null}
    </div>
  );
}
