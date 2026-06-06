"use client"

import * as React from "react"
import {
  ChevronRight,
  FilePen,
  FilePlus,
  FileText,
  FolderOpen,
  Loader2,
  Search,
  Terminal,
  Wrench,
} from "lucide-react"
import type { ToolItem } from "@/lib/fix-run-chat"
import { cn } from "@/lib/utils"

// A single real tool call the agent made — rendered as a slim one-line row to
// match the lifecycle markers. Click to reveal the full args + the tool output.
export function ToolCall({
  item,
  runActive,
}: {
  item: ToolItem
  runActive: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const pending = item.result === undefined && runActive
  const hasArgs = Object.keys(item.args).length > 0

  return (
    <div className="text-xs">
      <button
        aria-expanded={open}
        className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary/40"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <ToolGlyph className="size-3.5 shrink-0 text-secondary" name={item.toolName} />
        <span className="shrink-0">{item.toolName}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-secondary">
          {item.argSummary}
        </span>
        {pending ? (
          <Loader2 className="size-3 shrink-0 animate-spin text-secondary" />
        ) : (
          <ChevronRight
            className={cn(
              "size-3 shrink-0 text-tertiary opacity-0 transition group-hover:opacity-100",
              open && "rotate-90 opacity-100",
            )}
          />
        )}
      </button>

      {open ? (
        <div className="mt-2 ml-5 grid gap-2">
          {hasArgs ? (
            <pre className="max-h-64 overflow-auto rounded-md bg-secondary/40 p-2.5 font-mono text-[11px] leading-5">
              {JSON.stringify(item.args, null, 2)}
            </pre>
          ) : null}
          <pre className="max-h-64 overflow-auto rounded-md bg-secondary/40 p-2.5 font-mono text-[11px] leading-5 text-secondary">
            {item.result === undefined
              ? runActive
                ? "Running…"
                : "(no output recorded)"
              : item.result || "(empty)"}
          </pre>
        </div>
      ) : null}
    </div>
  )
}

function ToolGlyph({ name, className }: { name: string; className?: string }) {
  const n = name.toLowerCase()
  if (
    n.includes("command") ||
    n === "run" ||
    n.includes("bash") ||
    n.includes("shell") ||
    n.includes("exec")
  ) {
    return <Terminal className={className} />
  }
  if (
    n.includes("search") ||
    n.includes("grep") ||
    n.includes("ripgrep") ||
    n.includes("find")
  ) {
    return <Search className={className} />
  }
  if (n.includes("list") || n.includes("dir") || n === "ls") {
    return <FolderOpen className={className} />
  }
  if (n.includes("write") || n.includes("create")) {
    return <FilePlus className={className} />
  }
  if (n.includes("edit") || n.includes("patch") || n.includes("replace")) {
    return <FilePen className={className} />
  }
  if (n.includes("read") || n.includes("cat") || n.includes("file")) {
    return <FileText className={className} />
  }
  return <Wrench className={className} />
}
