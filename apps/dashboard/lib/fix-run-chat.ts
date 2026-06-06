import type { RunEventView } from "@repo/types/fix"
import type { ArtifactTab } from "@/lib/fix-run-view"
import { eventPayload } from "@/lib/fix-run-view"

// Turns the raw append-only run events into the *real* agent conversation that
// happened in the sandbox: the agent's own assistant messages + its tool calls
// (with paired results), grouped into the run's two passes (planning → fixing)
// with a result coda. Nothing here is hand-written narration — assistant text
// and tool args/results come straight from the logged events. The only
// "constructed" bits are the slim lifecycle markers (scan/clone/PR) that happen
// outside the agent loop, and the pass separators.

export type Pass = "planning" | "fixing" | "result"
export type SystemTone = "default" | "success" | "danger"
export type SystemIcon =
  | "scan"
  | "plan"
  | "sandbox"
  | "clone"
  | "diff"
  | "push"
  | "pr"
  | "done"
  | "error"
  | "info"

export interface SeparatorItem {
  kind: "separator"
  pass: Pass
  index: 1 | 2 | 3
  label: string
  sublabel: string
  status: "active" | "done"
}

export interface AssistantItem {
  kind: "assistant"
  seq: number
  text: string
  pass: Pass
}

export interface ToolItem {
  kind: "tool"
  seq: number
  toolName: string
  args: Record<string, unknown>
  argSummary: string
  result: string | undefined // undefined => still running (no result logged yet)
  pass: Pass
}

export interface SystemItem {
  kind: "system"
  seq: number
  icon: SystemIcon
  label: string
  detail: string | null
  tone: SystemTone
  pass: Pass
  artifact?: ArtifactTab
  href?: string
  // Expandable substeps (e.g. the scan's progress signals) shown in a dropdown.
  substeps?: string[]
}

export type TranscriptItem =
  | SeparatorItem
  | AssistantItem
  | ToolItem
  | SystemItem

const SEPARATOR_META: Record<
  Pass,
  { index: 1 | 2 | 3; label: string; sublabel: string }
> = {
  planning: { index: 1, label: "Planning", sublabel: "Inspecting your repo" },
  fixing: { index: 2, label: "Fixing", sublabel: "Applying changes" },
  result: { index: 3, label: "Result", sublabel: "" },
}

const RESULT_TRIGGERS = new Set([
  "pr_opened",
  "no_changes",
  "harness_error",
  "error",
])

export function buildTranscript(
  events: RunEventView[],
  opts: { runActive?: boolean } = {},
): TranscriptItem[] {
  const items: TranscriptItem[] = []
  const separators: SeparatorItem[] = []
  const seenPass = new Set<Pass>()
  const consumed = new Set<number>()
  let pass: Pass = "planning"
  let scanItem: SystemItem | null = null

  function ensureSeparator(p: Pass) {
    if (seenPass.has(p)) return
    seenPass.add(p)
    const meta = SEPARATOR_META[p]
    const item: SeparatorItem = {
      kind: "separator",
      pass: p,
      index: meta.index,
      label: meta.label,
      sublabel: meta.sublabel,
      status: "done",
    }
    items.push(item)
    separators.push(item)
  }

  // The planning pass always exists (a run starts by scanning + inspecting).
  ensureSeparator("planning")

  for (let i = 0; i < events.length; i++) {
    if (consumed.has(i)) continue
    const event = events[i]
    if (!event) continue
    const type = event.type

    // Pass transitions ----------------------------------------------------
    if (type === "harness_started") {
      pass = "fixing"
      ensureSeparator("fixing")
      continue // the ② separator stands in for this marker
    }
    if (RESULT_TRIGGERS.has(type)) {
      pass = "result"
      ensureSeparator("result")
      // fall through so the marker (pr_opened / error / …) still renders
    }

    // Scan: one expandable item that collects its progress substeps ---------
    if (type === "scan_started") {
      scanItem = {
        kind: "system",
        seq: event.seq,
        pass,
        icon: "scan",
        label: "Scanning the site for GEO/AEO issues",
        detail: null,
        tone: "default",
        substeps: [],
      }
      items.push(scanItem)
      continue
    }
    if (type === "scan_progress") {
      const message = str(eventPayload(event).message).trim()
      if (scanItem && message) scanItem.substeps!.push(message)
      continue
    }

    // Real assistant turns ------------------------------------------------
    if (type === "agent_assistant" || type === "planning_agent_assistant") {
      const text = str(eventPayload(event).content).trim()
      // Skip raw JSON dumps (e.g. the planner's final clarification object,
      // which drives the questions form — it must not leak into the chat).
      if (text && !isJsonDump(text)) {
        items.push({ kind: "assistant", seq: event.seq, text, pass })
      }
      continue
    }

    // Real tool calls (+ paired result) -----------------------------------
    if (type === "agent_tool_call" || type === "planning_agent_tool_call") {
      const prefix = type.startsWith("planning_")
        ? "planning_agent_"
        : "agent_"
      const payload = eventPayload(event)
      const args =
        payload.toolArgs && typeof payload.toolArgs === "object"
          ? (payload.toolArgs as Record<string, unknown>)
          : {}
      const toolName = str(payload.toolName) || "tool"

      let result: string | undefined
      for (let j = i + 1; j < events.length; j++) {
        const next = events[j]
        if (!next) continue
        if (next.type === `${prefix}tool_result`) {
          result = str(eventPayload(next).content)
          consumed.add(j)
          break
        }
        // The matching result is emitted before the next call; if we reach
        // another call first, this one is still in flight.
        if (next.type === `${prefix}tool_call`) break
      }

      items.push({
        kind: "tool",
        seq: event.seq,
        toolName,
        args,
        argSummary: argSummary(toolName, args),
        result,
        pass,
      })
      continue
    }

    // Orphan tool results (already folded into their call) ----------------
    if (
      type === "agent_tool_result" ||
      type === "planning_agent_tool_result"
    ) {
      continue
    }

    // Lifecycle markers ---------------------------------------------------
    const marker = systemMarker(event)
    if (marker) items.push({ kind: "system", seq: event.seq, pass, ...marker })
  }

  if (opts.runActive && separators.length) {
    separators[separators.length - 1]!.status = "active"
  }

  return items
}

// One-line summary of a tool call's args for the collapsed row.
export function argSummary(
  toolName: string,
  args: Record<string, unknown>,
): string {
  const pick = (key: string) =>
    typeof args[key] === "string" ? (args[key] as string) : ""

  const command = pick("command")
  if (command) return command
  const query = pick("query") || pick("pattern")
  if (query) return query
  const path =
    pick("path") || pick("file") || pick("filename") || pick("file_path")
  if (path) return path

  const json = safeJson(args)
  return json.length > 140 ? `${json.slice(0, 137)}…` : json
}

function systemMarker(
  event: RunEventView,
): Omit<SystemItem, "kind" | "seq" | "pass"> | null {
  const payload = eventPayload(event)
  switch (event.type) {
    // scan_started / scan_progress are handled specially (grouped, expandable).
    case "plan_built": {
      const total = num(payload.siteWide) + num(payload.perPage)
      const flagged = num(payload.flagged)
      return {
        icon: "plan",
        label: `Fix plan ready — ${total} fix${total === 1 ? "" : "es"}${
          flagged ? `, ${flagged} flagged` : ""
        }`,
        detail: "see the Checks tab",
        tone: "default",
        artifact: "checks",
      }
    }
    case "sandbox_created":
      return {
        icon: "sandbox",
        label: "Spun up a sandbox",
        detail: null,
        tone: "default",
      }
    case "repo_cloned": {
      const branch = str(payload.branch)
      return {
        icon: "clone",
        label: "Cloned the repo",
        detail: branch ? `branch ${branch}` : null,
        tone: "default",
      }
    }
    case "planning_agent_no_questions":
      return {
        icon: "done",
        label: "No clarification needed — proceeding to fix",
        detail: null,
        tone: "default",
      }
    case "planning_agent_invalid_response":
      return {
        icon: "info",
        label: "Skipped clarification — proceeding to fix",
        detail: null,
        tone: "default",
      }
    case "harness_continued":
      return {
        icon: "info",
        label: "Continuing — picking up where it left off",
        detail: null,
        tone: "default",
      }
    case "diff_summary":
      return {
        icon: "diff",
        label: "Committed changes",
        detail: "see the Diff tab",
        tone: "default",
        artifact: "diff",
      }
    case "merge_conflict_detected":
      return {
        icon: "info",
        label: "Hit merge conflicts with the base branch — resolving",
        detail: null,
        tone: "default",
      }
    case "merge_conflict_resolved":
      return {
        icon: "done",
        label: "Resolved the merge conflicts",
        detail: null,
        tone: "success",
      }
    case "merge_conflict_unresolved":
      return {
        icon: "error",
        label: "Couldn't auto-resolve the merge conflicts",
        detail: "the pull request will need a manual merge",
        tone: "danger",
      }
    case "merge_conflict": {
      const url = str(payload.prUrl)
      return {
        icon: "error",
        label: "Pull request has merge conflicts",
        detail: "the base branch changed — it needs a manual merge",
        tone: "danger",
        href: url || undefined,
      }
    }
    case "branch_pushed":
      return {
        icon: "push",
        label: "Pushed the fix branch",
        detail: null,
        tone: "default",
      }
    case "direct_push_failed":
      return {
        icon: "info",
        label: "Direct push failed — opening via a fork",
        detail: null,
        tone: "default",
      }
    case "pr_opened": {
      const number = num(payload.prNumber)
      const url = str(payload.prUrl)
      return {
        icon: "pr",
        label: `Opened pull request${number ? ` #${number}` : ""}`,
        detail: null,
        tone: "success",
        href: url || undefined,
      }
    }
    case "no_changes": {
      const summary = str(payload.summary)
      return {
        icon: "done",
        label: "No changes were needed",
        detail: summary || null,
        tone: "default",
      }
    }
    case "harness_error": {
      const error = str(payload.error)
      return {
        icon: "error",
        label: "The agent hit an error",
        detail: error || null,
        tone: "danger",
      }
    }
    case "error": {
      const error = str(payload.error)
      return {
        icon: "error",
        label: "Run failed",
        detail: error || null,
        tone: "danger",
      }
    }
    default:
      // Everything else (state_changed, token_usage_recorded, pr_strategy,
      // fork_ready, sandbox_reconnected/killed, harness_finished, intake,
      // clarification request, planning_agent_started/invalid, and the
      // happy-path merge events base_merge_clean / base_merge_failed /
      // pr_mergeable) is hidden — the chat never dumps raw event types.
      return null
  }
}

function str(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? ""
  } catch {
    return ""
  }
}

// True when the text is a raw JSON object dump (optionally fenced) rather than
// prose — used to keep the planner's clarification JSON out of the chat.
function isJsonDump(text: string): boolean {
  let t = text.trim()
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence?.[1]) t = fence[1].trim()
  if (!t.startsWith("{") || !t.endsWith("}")) return false
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
}
