"use client"

import * as React from "react"
import { ChevronRight, FileDiff } from "lucide-react"
import type { DashboardBadgeVariant } from "@/lib/dashboard-format"
import type { DiffFile, ParsedDiff } from "@/lib/fix-run-view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Renders the latest committed diff: a per-file collapsible list with +/- line
// coloring. No syntax-highlight dependency — just per-line classes off the
// unified patch the backend already logged.
export function DiffView({
  diff,
  prUrl,
  onShowChecks,
}: {
  diff: ParsedDiff | null
  prUrl: string | null
  onShowChecks: () => void
}) {
  if (!diff || diff.files.length === 0) {
    return (
      <div className="flex h-full min-h-72 flex-col items-center justify-center gap-4 text-center">
        <FileDiff className="size-12 -rotate-6 text-tertiary" strokeWidth={1.25} />
        <div className="space-y-1">
          <h3 className="text-sm font-medium">No file changes yet</h3>
          <p className="text-sm text-secondary">
            The diff appears here once the agent commits its changes.
          </p>
        </div>
        <Button onClick={onShowChecks} size="sm" variant="secondary">
          Track progress in Checks
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">
          {diff.files.length} file{diff.files.length === 1 ? "" : "s"} changed
        </span>
        <span className="rounded-md bg-success/10 px-1.5 py-0.5 font-mono text-xs text-success">
          +{diff.additions}
        </span>
        <span className="rounded-md bg-danger/10 px-1.5 py-0.5 font-mono text-xs text-danger">
          −{diff.deletions}
        </span>
        {diff.truncated ? <Badge variant="partial">truncated</Badge> : null}
      </div>

      <div className="grid gap-2">
        {diff.files.map((file, index) => (
          <DiffFileRow
            defaultOpen={index === 0}
            file={file}
            key={`${file.path}-${index}`}
          />
        ))}
      </div>

      {diff.truncated ? (
        <p className="text-xs text-secondary">
          Diff truncated for display.
          {prUrl ? (
            <>
              {" "}
              <a
                className="text-brand underline-offset-4 hover:underline"
                href={prUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open the PR
              </a>{" "}
              to see everything.
            </>
          ) : (
            " The full change is in the commit."
          )}
        </p>
      ) : null}
    </div>
  )
}

function DiffFileRow({
  file,
  defaultOpen,
}: {
  file: DiffFile
  defaultOpen: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const meta = statusMeta(file.status)
  const lines = file.patch ? file.patch.split("\n") : []

  return (
    <div className="overflow-hidden rounded-lg bg-secondary/30">
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-secondary transition-transform",
            open && "rotate-90",
          )}
        />
        <Badge variant={meta.variant}>{meta.label}</Badge>
        <span className="min-w-0 flex-1 truncate font-mono text-xs">
          {file.oldPath ? (
            <span className="text-secondary">{file.oldPath} → </span>
          ) : null}
          {file.path}
        </span>
        <span className="shrink-0 font-mono text-[11px]">
          <span className="text-success">+{file.additions}</span>{" "}
          <span className="text-danger">−{file.deletions}</span>
        </span>
      </button>

      {open ? (
        lines.length > 0 ? (
          <div className="max-h-[480px] overflow-auto border-t border-secondary bg-primary font-mono text-[11px] leading-5">
            {lines.map((line, index) => (
              <div
                className={cn("px-3 whitespace-pre", lineClass(line))}
                key={index}
              >
                {line || " "}
              </div>
            ))}
          </div>
        ) : (
          <p className="border-t border-secondary px-3 py-2 text-xs text-secondary">
            No textual diff (binary file or truncated before this file).
          </p>
        )
      ) : null}
    </div>
  )
}

function lineClass(line: string): string {
  if (line.startsWith("@@")) return "bg-secondary/40 text-secondary"
  if (
    line.startsWith("+++") ||
    line.startsWith("---") ||
    line.startsWith("diff --git") ||
    line.startsWith("index ") ||
    line.startsWith("new file") ||
    line.startsWith("deleted file") ||
    line.startsWith("rename ") ||
    line.startsWith("similarity ") ||
    line.startsWith("old mode") ||
    line.startsWith("new mode")
  ) {
    return "text-tertiary"
  }
  if (line.startsWith("+")) return "bg-success/10 text-success"
  if (line.startsWith("-")) return "bg-danger/10 text-danger"
  return "text-primary"
}

function statusMeta(status: string): {
  label: string
  variant: DashboardBadgeVariant
} {
  switch (status) {
    case "A":
      return { label: "added", variant: "pass" }
    case "D":
      return { label: "deleted", variant: "fail" }
    case "R":
      return { label: "renamed", variant: "partial" }
    case "C":
      return { label: "copied", variant: "neutral" }
    default:
      return { label: "modified", variant: "neutral" }
  }
}
