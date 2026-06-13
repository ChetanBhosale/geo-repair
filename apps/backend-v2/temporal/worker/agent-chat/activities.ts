import { prisma } from "@repo/db";
import { createHash } from "node:crypto";
import type { Prisma } from "@repo/db/generated/prisma/client";
import {
  connectSandbox,
  createSandbox,
  cloneRepo,
  getSandboxHost,
  refreshSandboxTimeout,
  runCommand,
  sandboxTools,
  startBackground,
} from "@repo/sandbox";
import {
  runAgent,
  DEFAULT_MODEL,
  imageTool,
  type AgentTool,
  type AgentStepLog,
} from "@repo/ai";
import { getPrStatus } from "../../../lib/github";
import { sendAiCreditsExhaustedEmail } from "../../../lib/email-notifications";
import { recordFollowUpAiUsage } from "../../../functions/ai-credits";
import type { AgentChatWorkflowInput } from "./workflow-types";
import { runScrape } from "../scraper/run";
import type { ScrapeResult } from "../scraper/types";
import { scoreGateBlockersForPr } from "../agent-fix/verification";

interface LogRef {
  agentRunId: string;
  projectId: string;
  userId: string;
}
type Source = "AGENT" | "AGENT_FILE";

const CHAT_SANDBOX_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const VALIDATION_OUTPUT_CHARS = 6_000;
const FINAL_MESSAGE_CHARS = 6_000;
const DEFAULT_SCAN_PORT = 3000;
const EDITS_BEFORE_VALIDATION = 6;
const REPAIR_MODE_SAFETY_MAX_STEPS = 220;
const REPAIR_MODE_FINAL_NUDGE_AFTER_STEPS = 200;
const CHAT_MODE_SAFETY_MAX_STEPS = 140;
const CHAT_MODE_FINAL_NUDGE_AFTER_STEPS = 120;

interface ValidationState {
  required: boolean;
  ran: boolean;
  passed: boolean;
  score: number | null;
  summary: string | null;
  fingerprint: string | null;
  failingApprovedChecks: string[];
  approvedCheckFailures: ApprovedCheckFailure[];
  scoreBlockers: string[];
  editCount: number;
  lastValidationEditCount: number;
}

interface ApprovedCheckFailure {
  rubricId: string;
  status: string;
  summary: string | null;
  recommendation: string | null;
  previousOutcome: string;
}

type ChatPrTarget =
  | {
      mode: "UPDATE_PR";
      branch: string;
      baseBranch: string;
      prNumber: number;
      prUrl: string;
    }
  | {
      mode: "FOLLOW_UP";
      branch: string;
      baseBranch: string;
      previousPrUrl: string | null;
      previousPrState: DbPrState;
    };

type DbPrState = "NONE" | "OPEN" | "MERGED" | "CLOSED";

type ChatRunForTarget = {
  id: string;
  branch: string | null;
  prUrl: string | null;
  prNumber: number | null;
  prState: DbPrState;
  prMerged: boolean;
  project: {
    owner: string;
    name: string;
    defaultBranch: string;
  };
};

function clamp(s: string, max = VALIDATION_OUTPUT_CHARS): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n...[truncated ${s.length - max} chars]`;
}

function commandOutput(
  name: string,
  res: { exitCode: number; stdout: string; stderr: string },
): string {
  return clamp(
    [
      `${name} exit: ${res.exitCode}`,
      res.stdout ? `stdout:\n${res.stdout}` : "",
      res.stderr ? `stderr:\n${res.stderr}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function approvedCheck(row: { mode: string; choice: string }): boolean {
  return row.mode === "AUTO" || row.choice === "APPROVED";
}

function pathFromScannedUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return value.startsWith("/") ? value : null;
  }
}

function pathsFromStoredScan(result: ScrapeResult | null): string[] {
  if (!result) return [];
  const paths = new Set<string>();
  for (const value of [result.url, result.finalUrl]) {
    const path = pathFromScannedUrl(value);
    if (path) paths.add(path);
  }
  for (const log of result.logs ?? []) {
    const path = pathFromScannedUrl(log.page);
    if (path) paths.add(path);
  }
  for (const check of result.checks ?? []) {
    for (const affected of check.affectedPages ?? []) {
      const path = pathFromScannedUrl(affected.page);
      if (path) paths.add(path);
    }
  }
  return [...paths];
}

async function workingTreeFingerprint(
  sandbox: Awaited<ReturnType<typeof createSandbox>>,
  workdir: string,
): Promise<string> {
  const [status, diff, cachedDiff] = await Promise.all([
    runCommand(sandbox, "git status --porcelain", { cwd: workdir }),
    runCommand(sandbox, "git diff --binary", {
      cwd: workdir,
      timeoutMs: 60 * 1000,
    }),
    runCommand(sandbox, "git diff --cached --binary", {
      cwd: workdir,
      timeoutMs: 60 * 1000,
    }),
  ]);

  return createHash("sha256")
    .update(status.stdout)
    .update("\n---diff---\n")
    .update(diff.stdout)
    .update("\n---cached---\n")
    .update(cachedDiff.stdout)
    .digest("hex");
}

async function writeLog(
  ref: LogRef,
  source: Source,
  level: "INFO" | "WARN" | "ERROR",
  event: string,
  message: string,
  data?: Prisma.InputJsonValue,
) {
  await prisma.log
    .create({
      data: {
        source,
        level,
        event,
        message,
        data,
        agentRunId: ref.agentRunId,
        projectId: ref.projectId,
        userId: ref.userId,
      },
    })
    .catch(() => {});
}

function followUpBranch(agentRunId: string): string {
  return `geo-repair/followup-${agentRunId.slice(-8)}-${Date.now().toString(36)}`;
}

async function resolveChatPrTarget(
  run: ChatRunForTarget,
  token: string | undefined,
  ref: LogRef,
): Promise<ChatPrTarget> {
  let prState: DbPrState = run.prState;
  let prMerged = run.prState === "MERGED" || run.prMerged;

  if (run.prNumber) {
    const pr = await getPrStatus(
      run.project.owner,
      run.project.name,
      run.prNumber,
      token,
    );
    if (pr?.merged) {
      prState = "MERGED";
      prMerged = true;
      await prisma.agentRun.update({
        where: { id: run.id },
        data: { prMerged: true, prState: "MERGED", prMergedAt: new Date() },
      });
    } else if (pr?.state === "open" || pr?.state === "closed") {
      prState = pr.state === "closed" ? "CLOSED" : "OPEN";
      prMerged = false;
      if (run.prMerged || run.prState !== prState) {
        await prisma.agentRun.update({
          where: { id: run.id },
          data: { prMerged: false, prState, prMergedAt: null },
        });
      }
    }
  }

  if (run.prNumber && run.prUrl && !prMerged && prState === "OPEN") {
    return {
      mode: "UPDATE_PR",
      branch: run.branch ?? run.project.defaultBranch,
      baseBranch: run.project.defaultBranch,
      prNumber: run.prNumber,
      prUrl: run.prUrl,
    };
  }

  const target: ChatPrTarget = {
    mode: "FOLLOW_UP",
    branch: followUpBranch(run.id),
    baseBranch: run.project.defaultBranch,
    previousPrUrl: run.prUrl,
    previousPrState: prState,
  };
  await writeLog(
    ref,
    "AGENT",
    "INFO",
    "followup_pr_started",
    `The previous PR is ${prState.toLowerCase()}. This message will open a follow-up PR if changes are needed.`,
    {
      previousPrUrl: run.prUrl,
      previousPrState: prState,
      branch: target.branch,
    },
  );
  return target;
}

async function openFollowUpPullRequest(args: {
  run: ChatRunForTarget;
  branch: string;
  token: string | undefined;
  previousPrUrl: string | null;
}): Promise<{ prUrl: string; prNumber: number | null }> {
  const { run, branch, token, previousPrUrl } = args;
  if (!token) throw new Error("GitHub token is required to open a follow-up PR.");

  const body = [
    "Follow-up changes from the existing GEO Repair agent thread.",
    previousPrUrl ? `Previous PR: ${previousPrUrl}` : "",
    "This PR updates the same paid fix workspace. It improves technical AI search readiness only.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const prRes = await fetch(
    `https://api.github.com/repos/${run.project.owner}/${run.project.name}/pulls`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "geo-repair",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title: "GEO Repair: follow-up AI search fix",
        head: branch,
        base: run.project.defaultBranch,
        body,
      }),
    },
  );

  const pr = (await prRes.json().catch(() => ({}))) as {
    html_url?: string;
    number?: number;
    message?: string;
  };
  if (!prRes.ok || !pr.html_url) {
    throw new Error(`Follow-up PR creation failed: ${pr.message ?? prRes.status}`);
  }
  return { prUrl: pr.html_url, prNumber: pr.number ?? null };
}

async function updatePlanFromScan(
  input: AgentChatWorkflowInput,
  result: ScrapeResult,
): Promise<ApprovedCheckFailure[]> {
  const plan = await prisma.agentPlan.findUnique({
    where: { agentRunId: input.agentRunId },
    include: { checks: { orderBy: { seq: "asc" } } },
  });
  if (!plan) return [];

  const byRubric = new Map(result.checks.map((check) => [check.name, check]));
  const failing: ApprovedCheckFailure[] = [];

  for (const check of plan.checks) {
    if (!approvedCheck(check)) continue;

    const scanned = byRubric.get(check.rubricId);
    if (!scanned || scanned.status === "NOT_APPLICABLE") continue;

    if (scanned.status === "SUCCESS") {
      await prisma.agentPlanCheck.update({
        where: { id: check.id },
        data: {
          scanStatus: scanned.status,
          outcome: "FIXED",
          reason: "Verified passing by revalidation scan.",
        },
      });
      continue;
    }

    failing.push({
      rubricId: check.rubricId,
      status: scanned.status,
      summary: scanned.summary ?? null,
      recommendation: scanned.recommendation ?? null,
      previousOutcome: check.outcome,
    });
    const reasonPrefix =
      check.outcome === "FIXED"
        ? `Regressed in latest revalidation (${scanned.status})`
        : `Still ${scanned.status} after revalidation`;
    await prisma.agentPlanCheck.update({
      where: { id: check.id },
      data: {
        scanStatus: scanned.status,
        outcome: "FAILED",
        reason: `${reasonPrefix}: ${
          scanned.recommendation ?? scanned.summary
        }`.slice(0, 500),
      },
    });
  }

  const [fixedChecks, skippedChecks, pendingChecks] = await Promise.all([
    prisma.agentPlanCheck.count({
      where: { agentPlanId: plan.id, outcome: "FIXED" },
    }),
    prisma.agentPlanCheck.count({
      where: { agentPlanId: plan.id, outcome: "SKIPPED_BY_USER" },
    }),
    prisma.agentPlanCheck.count({
      where: { agentPlanId: plan.id, outcome: { in: ["PENDING", "FAILED"] } },
    }),
  ]);

  await prisma.agentRun.update({
    where: { id: input.agentRunId },
    data: {
      scoreAfter: result.score.overall,
      fixedChecks,
      skippedChecks,
      pendingChecks,
    },
  });

  return failing;
}

// Rebuild the agent's memory from the DB: what the plan was, what got fixed,
// which files changed, and the recent conversation. This is the durable context
// we hand the model each turn (the sandbox gives it the live code).
async function buildContext(agentRunId: string): Promise<string> {
  const run = await prisma.agentRun.findUnique({
    where: { id: agentRunId },
    include: { plan: { include: { checks: { orderBy: { seq: "asc" } } } } },
  });

  const parts: string[] = [];
  if (run?.plan?.summary) parts.push(`Plan summary: ${run.plan.summary}`);
  if (run?.plan?.checks?.length) {
    const lines = run.plan.checks.map(
      (c) =>
        `- ${c.rubricId}: ${c.outcome}${c.approach ? ` — ${c.approach}` : ""}`,
    );
    parts.push(`Checks and outcomes:\n${lines.join("\n")}`);
  }

  const fileLogs = await prisma.log.findMany({
    where: { agentRunId, source: "AGENT_FILE", event: "file_change" },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const files = [
    ...new Set(
      fileLogs
        .map((l) => (l.data as { path?: string } | null)?.path)
        .filter((p): p is string => !!p),
    ),
  ];
  if (files.length)
    parts.push(
      `Files changed so far:\n${files.map((f) => `- ${f}`).join("\n")}`,
    );

  if (run?.prUrl)
    parts.push(`Latest PR: ${run.prUrl} (branch ${run.branch ?? "?"})`);

  const latestValidation = await prisma.log.findFirst({
    where: {
      agentRunId,
      event: { in: ["verify_failed", "validation_passed"] },
    },
    orderBy: [{ createdAt: "desc" }, { seq: "desc" }],
  });
  if (latestValidation) {
    const workQueue = formatValidationWorkQueue(
      latestValidation.data,
      latestValidation.message,
    );
    if (workQueue) parts.push(workQueue);

    const data = latestValidation.data
      ? `\n${clamp(JSON.stringify(latestValidation.data, null, 2), 2_500)}`
      : "";
    parts.push(`Latest validation result:\n${latestValidation.message}${data}`);
  }

  // Recent conversation transcript.
  const msgs = await prisma.log.findMany({
    where: {
      agentRunId,
      source: { in: ["USER", "AGENT"] },
      event: { in: ["user_message", "revalidate_requested", "agent_message"] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const transcript = msgs
    .reverse()
    .map((m) => `${m.source === "USER" ? "User" : "Agent"}: ${m.message ?? ""}`)
    .join("\n");
  if (transcript) parts.push(`Recent conversation:\n${transcript}`);

  return parts.join("\n\n");
}

function objectRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function approvedFailureList(value: unknown): ApprovedCheckFailure[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object" && !Array.isArray(item),
    )
    .map((item) => ({
      rubricId:
        typeof item.rubricId === "string" ? item.rubricId : "unknown-check",
      status: typeof item.status === "string" ? item.status : "UNKNOWN",
      summary: typeof item.summary === "string" ? item.summary : null,
      recommendation:
        typeof item.recommendation === "string" ? item.recommendation : null,
      previousOutcome:
        typeof item.previousOutcome === "string"
          ? item.previousOutcome
          : "UNKNOWN",
    }));
}

function formatValidationWorkQueue(
  data: Prisma.JsonValue | null,
  message: string | null,
): string | null {
  const record = objectRecord(data);
  const scoreBlockers = stringList(record.scoreBlockers);
  const failedChecks = stringList(record.failedChecks);
  const includePaths = stringList(record.includePaths).slice(0, 16);
  const approvedFailures = approvedFailureList(record.approvedCheckFailures);

  if (
    scoreBlockers.length === 0 &&
    failedChecks.length === 0 &&
    approvedFailures.length === 0
  ) {
    return null;
  }

  const lines = [
    "Current validation repair queue. Start here; do not repeat broad repo discovery.",
  ];
  if (typeof record.score === "number") {
    lines.push(`Current score: ${record.score}/100.`);
  }
  if (message) lines.push(`Latest validation summary: ${message}`);
  if (scoreBlockers.length > 0) {
    lines.push(
      `Score blockers:\n${scoreBlockers.map((blocker) => `- ${blocker}`).join("\n")}`,
    );
  }
  if (approvedFailures.length > 0) {
    lines.push(
      `Approved checks still failing:\n${approvedFailures
        .map((failure) =>
          [
            `- ${failure.rubricId}: ${failure.status}`,
            failure.summary ? `  Summary: ${failure.summary}` : "",
            failure.recommendation
              ? `  Recommendation: ${failure.recommendation}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n")}`,
    );
  }
  if (failedChecks.length > 0) {
    lines.push(`Failed scan checks: ${failedChecks.join(", ")}.`);
  }
  if (includePaths.length > 0) {
    lines.push(`Validation covered routes: ${includePaths.join(", ")}.`);
  }
  lines.push(
    "Repair guidance: make concrete website/app fixes for the listed checks first, then call validate_pr_branch. Only inspect checker code if a listed failure is contradictory.",
  );

  return lines.join("\n\n");
}

function shouldUseRepairMode(message: string, context: string): boolean {
  if (!context.includes("Current validation repair queue")) return false;
  return /\b(fix|validate|revalidate|pending|failed|checks?|score|again|continue|finish|pass|100)\b/i.test(
    message,
  );
}

function chatSystemPrompt(): string {
  return `You are the GEO Repair fix agent in follow-up mode. You are back in a sandbox for the latest fix target, with full read/edit/write/run tools. Earlier work and the conversation are your memory; build on them, do not start over.

Apply the user's latest request to the current fix branch.
Rules:
- Narrate like a human engineer before tool calls. Use varied, context-aware sentences that explain what the last result suggests and why the next step follows; one sentence is fine for simple steps, two is better when the reasoning would otherwise feel abrupt. Avoid repeating "I will..." or "I am going to...", and do not just restate the command or file name.
- Make the SMALLEST edit that satisfies the request; match the file's existing style. Stay within the spirit of the GEO/AEO/SEO fix.
- After any file edit or generated asset, run a fresh validation before you finish: discover the correct install/build/serve commands, call validate_pr_branch with the local server command and port, read the result, and fix/rerun if it reports failures.
- Use run_command only for short diagnostics. Do not use raw run_command for long build, server, or full scan verification after edits; those must go through validate_pr_branch so the harness can bound, score, and record the result.
- If the context includes a Current validation repair queue, treat that as the active work queue. Make a concrete edit for those blockers before spending more than five tools on reading/searching.
- Do NOT run git yourself; the harness commits and pushes after you finish.
- Never invent claims, content, or sources. The user can only send text — if you need an image, ask for a URL or generate one.
- If something can't be done safely, say so and make no edits.
When done, send a long, human-readable summary message. Include what you changed, which files or surfaces were affected, what validation/build commands you ran, what passed, what is still failing or blocked, and what the user should expect next. Do not make it terse unless nothing happened.`;
}

function revalidateSystemPrompt(): string {
  return `${chatSystemPrompt()}

This turn is an internal revalidation request, not a normal user chat message.
Your job is to make the PR branch actually pass:
- Inspect the repository and infer the correct package manager, install command, build/type-check command, app start command, app directory, and port. Do not assume root scripts are enough in a monorepo.
- Use the repo's package manager. Do not fall back to npm unless the repo actually uses npm.
- Fix build, type, lint, or framework errors before touching content checks.
- For local score checks, start the website app through validate_pr_branch with the commands and port you discovered. You may use curl through run_command while diagnosing, but run_command is bounded and must not be used for the final build/server/scan loop.
- If validate_pr_branch reports scoreBlockers or failed approved checks, treat those returned blockers as the work queue: make concrete fixes in the website/app files, then call validate_pr_branch again.
- If the context includes a Current validation repair queue, begin from that queue. Do not rediscover the whole app before the first concrete fix.
- Do not spend the turn only reverse-engineering the checker. Read checker code only when the validation output is contradictory or the user explicitly asks to debug the checker.
- Do not search for scanner scripts after validate_pr_branch returns approvedCheckFailures. The validation result is already the source of truth for this turn.
- Do not finish until validate_pr_branch passes, or until you can clearly explain why the branch cannot be fixed safely.`;
}

function formatApprovedFailures(failures: ApprovedCheckFailure[]): string {
  if (failures.length === 0)
    return "- No approved-check failures were recorded.";
  return failures
    .map((failure) =>
      [
        `- ${failure.rubricId}: ${failure.status}`,
        failure.summary ? `  Summary: ${failure.summary}` : "",
        failure.recommendation
          ? `  Recommendation: ${failure.recommendation}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
}

function closingMessage(args: {
  finalText: string;
  stoppedReason: "done" | "max_steps";
  validation: ValidationState;
  repairMode: boolean;
  dirty: boolean;
  pushed: boolean;
  pushFailed: boolean;
}): string {
  const {
    finalText,
    stoppedReason,
    validation,
    repairMode,
    dirty,
    pushed,
    pushFailed,
  } =
    args;
  const turnLabel = repairMode ? "The repair turn" : "The chat turn";

  if (validation.ran && !validation.passed) {
    return [
      stoppedReason === "max_steps"
        ? `${turnLabel} hit its tool-step limit before it could finish the remaining fixes cleanly.`
        : `${turnLabel} completed, but the branch still did not pass validation.`,
      validation.summary
        ? `Latest validation result: ${validation.summary}`
        : "Latest validation result: failed.",
      `Score blockers still failing:\n${
        validation.scoreBlockers.length
          ? validation.scoreBlockers.map((blocker) => `- ${blocker}`).join("\n")
          : formatApprovedFailures(validation.approvedCheckFailures)
      }`,
      dirty
        ? "The agent made local sandbox edits, but the harness did not push them because the latest validation did not pass."
        : "No PR changes were pushed because validation did not pass.",
      "Next step: continue directly from the score blocker list above and make concrete website/app fixes for those checks, then run validate_pr_branch again.",
    ].join("\n\n");
  }

  if (stoppedReason === "max_steps") {
    return [
      "The agent reached its tool-step limit before producing a clean final summary.",
      dirty && !pushed
        ? "It left local sandbox edits unpushed because they were not validated on the latest tree."
        : pushFailed
          ? "It attempted to push, but the push failed."
          : "No additional action was pushed from this turn.",
      finalText.trim()
        ? `Last model note before stopping: ${finalText.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return finalText.slice(0, FINAL_MESSAGE_CHARS) || "Done.";
}

function createValidationTool(args: {
  input: AgentChatWorkflowInput;
  sandbox: Awaited<ReturnType<typeof createSandbox>>;
  workdir: string;
  ref: LogRef;
  state: ValidationState;
}): AgentTool {
  const { input, sandbox, workdir, ref, state } = args;

  return {
    name: "validate_pr_branch",
    description:
      "Run the validation commands you discovered for this PR branch. " +
      "Executes install/build, starts the app, runs the GEO Repair scanner against the local server, and records whether the branch is safe to push.",
    parameters: {
      type: "object",
      properties: {
        installCommand: {
          type: "string",
          description:
            "Optional install command, for example 'bun install'. Use an empty string to skip.",
        },
        buildCommand: {
          type: "string",
          description:
            "Required command proving the changed repo builds/type-checks, for example 'bun run build' or a monorepo-filtered command.",
        },
        startCommand: {
          type: "string",
          description:
            "Command that starts the website app for scanning, for example 'cd apps/web && bun run start'. Required for validation to pass.",
        },
        port: {
          type: "number",
          description: "Port exposed by startCommand. Defaults to 3000.",
        },
        path: {
          type: "string",
          description: "Path to scan on the local server. Defaults to '/'.",
        },
        maxPages: {
          type: "number",
          description: "Maximum pages for the scanner. Defaults to 6.",
        },
      },
      required: ["buildCommand"],
    },
    execute: async (toolArgs) => {
      state.ran = true;
      state.passed = false;
      state.summary = null;
      state.fingerprint = null;
      state.scoreBlockers = [];

      const installCommand = String(toolArgs.installCommand ?? "").trim();
      const buildCommand = String(toolArgs.buildCommand ?? "").trim();
      const startCommand = String(toolArgs.startCommand ?? "").trim();
      const port =
        typeof toolArgs.port === "number" && Number.isFinite(toolArgs.port)
          ? Math.max(1, Math.round(toolArgs.port))
          : DEFAULT_SCAN_PORT;
      const path = String(toolArgs.path ?? "/").startsWith("/")
        ? String(toolArgs.path ?? "/")
        : `/${String(toolArgs.path ?? "/")}`;
      const maxPages =
        typeof toolArgs.maxPages === "number" &&
        Number.isFinite(toolArgs.maxPages)
          ? Math.max(1, Math.round(toolArgs.maxPages))
          : 6;

      if (!buildCommand) {
        state.summary = "buildCommand is required.";
        return state.summary;
      }

      await writeLog(
        ref,
        "AGENT_FILE",
        "INFO",
        "command",
        `$ validate_pr_branch: ${buildCommand}`,
      );

      if (installCommand) {
        await writeLog(
          ref,
          "AGENT_FILE",
          "INFO",
          "command",
          `$ ${installCommand}`,
        );
        const install = await runCommand(sandbox, installCommand, {
          cwd: workdir,
          timeoutMs: 5 * 60 * 1000,
        });
        if (install.exitCode !== 0) {
          const output = commandOutput("Install", install);
          state.summary = output;
          await writeLog(ref, "AGENT_FILE", "ERROR", "verify_failed", output);
          return output;
        }
      }

      await writeLog(ref, "AGENT_FILE", "INFO", "command", `$ ${buildCommand}`);
      const build = await runCommand(sandbox, buildCommand, {
        cwd: workdir,
        timeoutMs: 10 * 60 * 1000,
      });
      if (build.exitCode !== 0) {
        const output = commandOutput("Build", build);
        state.summary = output;
        await writeLog(ref, "AGENT_FILE", "ERROR", "verify_failed", output);
        return output;
      }

      if (!startCommand) {
        const message =
          "Build passed, but validation requires a local server scan. Call validate_pr_branch again with startCommand and port.";
        state.passed = false;
        state.summary = message;
        await writeLog(ref, "AGENT_FILE", "ERROR", "verify_failed", message);
        return message;
      }

      await writeLog(ref, "AGENT_FILE", "INFO", "command", `$ ${startCommand}`);
      const server = await startBackground(sandbox, startCommand, {
        cwd: workdir,
        envs: {
          PORT: String(port),
          HOST: "0.0.0.0",
          HOSTNAME: "0.0.0.0",
          NODE_ENV: "production",
        },
      });

      try {
        const host = getSandboxHost(sandbox, port);
        const baseUrl = `https://${host}`;
        const scanUrl = new URL(path, baseUrl).toString();
        let up = false;
        for (let i = 0; i < 30; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          try {
            const res = await fetch(scanUrl, {
              method: "GET",
              signal: AbortSignal.timeout(4000),
            });
            if (res.status > 0) {
              up = true;
              break;
            }
          } catch {
            /* server is still starting */
          }
        }

        if (!up) {
          const message = `Server did not answer on ${scanUrl}. Check the start command and port.`;
          state.summary = message;
          await writeLog(ref, "AGENT_FILE", "ERROR", "verify_failed", message);
          return message;
        }

        await writeLog(
          ref,
          "AGENT_FILE",
          "INFO",
          "rescan_started",
          `Scanning local server ${scanUrl}`,
        );
        const run = await prisma.agentRun.findUnique({
          where: { id: input.agentRunId },
          include: { scraping: { select: { result: true } } },
        });
        const includePaths = pathsFromStoredScan(
          (run?.scraping?.result as unknown as ScrapeResult | null) ?? null,
        );
        const result = await runScrape(scanUrl, {
          maxPages: Math.max(maxPages, includePaths.length, 20),
          includePaths,
          concurrency: 3,
        });
        const approvedCheckFailures = await updatePlanFromScan(input, result);
        const failingApprovedChecks = approvedCheckFailures.map(
          (failure) => failure.rubricId,
        );
        const plan = await prisma.agentPlan.findUnique({
          where: { agentRunId: input.agentRunId },
          include: { checks: { orderBy: { seq: "asc" } } },
        });
        const scoreBlockers = scoreGateBlockersForPr({
          score: result.score.overall,
          checks: result.checks.map((check) => ({
            rubricId: check.name,
            status: check.status,
            pointsPossible: check.pointsPossible,
          })),
          readiness:
            plan?.checks.map((check) => ({
              rubricId: check.rubricId,
              mode: check.mode,
              choice: check.choice,
              outcome: check.outcome,
            })) ?? [],
        });
        const failedChecks = result.checks
          .filter(
            (check) => check.status === "FAILED" || check.status === "MID",
          )
          .map((check) => `${check.name}:${check.status}`)
          .slice(0, 12);

        state.passed =
          scoreBlockers.length === 0 && result.status === "completed";
        state.score = result.score.overall;
        state.failingApprovedChecks = failingApprovedChecks;
        state.approvedCheckFailures = approvedCheckFailures;
        state.scoreBlockers = scoreBlockers;
        state.fingerprint = state.passed
          ? await workingTreeFingerprint(sandbox, workdir)
          : null;
        state.summary = state.passed
          ? `Validation passed. Local scan score: ${result.score.overall}/100.`
          : `Validation failed. Local scan score: ${result.score.overall}/100. Score blockers: ${scoreBlockers.join(", ") || "none"}.`;
        const validationData: Prisma.InputJsonValue = {
          score: result.score.overall,
          failingApprovedChecks,
          scoreBlockers,
          includePaths,
          approvedCheckFailures: approvedCheckFailures.map((failure) => ({
            rubricId: failure.rubricId,
            status: failure.status,
            summary: failure.summary,
            recommendation: failure.recommendation,
            previousOutcome: failure.previousOutcome,
          })),
          failedChecks,
        };
        await writeLog(
          ref,
          "AGENT_FILE",
          state.passed ? "INFO" : "ERROR",
          state.passed ? "validation_passed" : "verify_failed",
          state.summary,
          validationData,
        );

        return clamp(
          JSON.stringify(
            {
              passed: state.passed,
              score: result.score.overall,
              failingApprovedChecks,
              scoreBlockers,
              approvedCheckFailures,
              failedChecks,
              pagesChecked: result.crawl.pagesChecked,
              summary: state.summary,
            },
            null,
            2,
          ),
        );
      } finally {
        await server.kill();
      }
    },
  };
}

// One chat turn: revive/create the sandbox (keep it alive), inspect + edit on
// the fix branch, commit + push to update the PR, persist the reply, and check
// if the PR has been merged.
export async function runChatActivity(
  input: AgentChatWorkflowInput,
): Promise<void> {
  const ref: LogRef = {
    agentRunId: input.agentRunId,
    projectId: input.projectId,
    userId: input.userId,
  };
  const revalidating = input.kind === "REVALIDATE";
  const validation: ValidationState = {
    required: revalidating,
    ran: false,
    passed: false,
    score: null,
    summary: null,
    fingerprint: null,
    failingApprovedChecks: [],
    approvedCheckFailures: [],
    scoreBlockers: [],
    editCount: 0,
    lastValidationEditCount: 0,
  };

  const run = await prisma.agentRun.findFirst({
    where: { id: input.agentRunId, userId: input.userId },
    include: {
      project: { include: { account: { select: { accessToken: true } } } },
    },
  });
  if (!run || !run.project) throw new Error("Run/project not found for chat.");
  const token = run.project.account?.accessToken ?? undefined;
  const workdir = "/home/user/repo";
  let sandbox = null as Awaited<ReturnType<typeof createSandbox>> | null;

  try {
    const target = await resolveChatPrTarget(run, token, ref);
    let latestPrNumber =
      target.mode === "UPDATE_PR" ? target.prNumber : run.prNumber;

    // Revive the sandbox only when it is already on the open PR branch.
    // Follow-up PRs start from the default branch in a fresh sandbox.
    if (target.mode === "UPDATE_PR" && run.sandboxId) {
      try {
        const existing = await connectSandbox(run.sandboxId);
        const probe = await runCommand(
          existing,
          "git rev-parse --abbrev-ref HEAD",
          { cwd: workdir },
        );
        if (probe.exitCode === 0 && probe.stdout.trim() === target.branch) {
          sandbox = existing;
          await refreshSandboxTimeout(sandbox, CHAT_SANDBOX_IDLE_TIMEOUT_MS);
        }
      } catch {
        sandbox = null;
      }
    }

    if (!sandbox) {
      await writeLog(
        ref,
        "AGENT",
        "INFO",
        "sandbox_creating",
        "Starting a sandbox for this chat...",
      );
      sandbox = await createSandbox({
        timeoutMs: CHAT_SANDBOX_IDLE_TIMEOUT_MS,
      });
      const { result } = await cloneRepo(sandbox, {
        cloneUrl: run.project.cloneUrl,
        branch:
          target.mode === "UPDATE_PR" ? target.branch : target.baseBranch,
        token,
      });
      if (result.exitCode !== 0)
        throw new Error(`Clone failed: ${result.stderr.slice(0, 200)}`);
      if (target.mode === "FOLLOW_UP") {
        const checkout = await runCommand(
          sandbox,
          `git checkout -b ${target.branch}`,
          { cwd: workdir },
        );
        if (checkout.exitCode !== 0) {
          throw new Error(
            `Follow-up branch checkout failed: ${checkout.stderr.slice(0, 200)}`,
          );
        }
      }
      await runCommand(
        sandbox,
        `git config user.email "agent@geo.repair" && git config user.name "GEO Repair Agent"`,
        { cwd: workdir },
      );
      await prisma.agentRun.update({
        where: { id: run.id },
        data: { sandboxId: sandbox.sandboxId, sandboxStatus: "RUNNING" },
      });
    }

    const context = await buildContext(input.agentRunId);
    const repairMode = revalidating || shouldUseRepairMode(input.message, context);
    validation.required = repairMode;
    const tools = sandboxTools(sandbox, {
      workdir,
      maxOutputChars: 6_000,
      defaultCommandTimeoutMs: 2 * 60 * 1000,
      maxCommandTimeoutMs: 5 * 60 * 1000,
    }) as AgentTool[];
    tools.push(
      createValidationTool({
        input,
        sandbox,
        workdir,
        ref,
        state: validation,
      }),
    );
    if (process.env.OPEN_ROUTER_KEY) {
      tools.push(
        imageTool({
          onImage: async (image, a) => {
            const rel = a.path ?? "public/og.png";
            try {
              await sandbox!.files.write(
                `${workdir}/${rel}`,
                new Blob([Buffer.from(image.base64, "base64")]),
              );
            } catch (e) {
              return `Generated image but could not write ${rel}: ${e instanceof Error ? e.message : String(e)}`;
            }
            await writeLog(
              ref,
              "AGENT_FILE",
              "INFO",
              "file_change",
              `Generated image ${rel}`,
              { path: rel, action: "create" },
            );
            return `Saved a generated ${image.mimeType} image to ${rel}.`;
          },
        }),
      );
    }

    const onEvent = async (e: AgentStepLog) => {
      if (e.type === "assistant" && e.content?.trim()) {
        await writeLog(ref, "AGENT", "INFO", "agent_message", e.content.trim());
      } else if (e.type === "tool_call") {
        const a = e.toolArgs ?? {};
        if (e.toolName === "edit_file" || e.toolName === "write_file") {
          await writeLog(
            ref,
            "AGENT_FILE",
            "INFO",
            "file_change",
            `${e.toolName === "write_file" ? "Created" : "Edited"} ${String(a.path ?? "")}`,
            {
              path: String(a.path ?? ""),
              action: e.toolName === "write_file" ? "create" : "modify",
            },
          );
        } else if (e.toolName === "run_command") {
          await writeLog(
            ref,
            "AGENT_FILE",
            "INFO",
            "command",
            `$ ${String(a.command ?? "")}`,
          );
        } else if (e.toolName === "read_file") {
          await writeLog(
            ref,
            "AGENT_FILE",
            "INFO",
            "read",
            `Reading ${String(a.path ?? "")}`,
          );
        }
      } else if (e.type === "tool_result" && e.toolName === "run_command") {
        await writeLog(
          ref,
          "AGENT_FILE",
          "INFO",
          "command_result",
          clamp(e.content ?? "", 2_000),
        );
      }
    };

    let creditsExhaustedEmailSent = false;
    const onUsage = async (usage: {
      inputTokens: number;
      outputTokens: number;
    }) => {
      if (!run.orderId) {
        await prisma.agentRun
          .update({
            where: { id: run.id },
            data: {
              tokensIn: { increment: usage.inputTokens },
              tokensOut: { increment: usage.outputTokens },
              model: DEFAULT_MODEL,
            },
          })
          .catch(() => {});
        return;
      }

      const credits = await recordFollowUpAiUsage({
        orderId: run.orderId,
        agentRunId: run.id,
        workflowId: run.temporalWorkflowId,
        model: DEFAULT_MODEL,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        reason: revalidating ? "revalidate" : "chat",
      });

      if (credits.aiCreditsLeft <= 0 && !creditsExhaustedEmailSent) {
        creditsExhaustedEmailSent = true;
        await sendAiCreditsExhaustedEmail(run.id).catch((sendErr) => {
          console.error("[email] AI credits exhausted notification failed:", sendErr);
        });
      }
    };

    const res = await runAgent({
      system: repairMode ? revalidateSystemPrompt() : chatSystemPrompt(),
      user: `${context}\n\n---\nUser's request:\n${input.message}`,
      tools,
      maxSteps: repairMode
        ? REPAIR_MODE_SAFETY_MAX_STEPS
        : CHAT_MODE_SAFETY_MAX_STEPS,
      forceFinalAfterSteps: repairMode
        ? REPAIR_MODE_FINAL_NUDGE_AFTER_STEPS
        : CHAT_MODE_FINAL_NUDGE_AFTER_STEPS,
      finalInstruction: repairMode
        ? "If validate_pr_branch has not passed and there is an obvious code or content fix left, keep using tools: edit the website/app files and validate again. Only stop if validation passed or you cannot safely make another fix. When you stop, send a detailed multi-paragraph summary covering edits, files, validation commands/results, remaining failures, blockers, and next steps."
        : "If you changed files, validate the PR branch with validate_pr_branch before finishing. If validation has not passed, explain the blocker instead of claiming the PR is updated. When you stop, send a detailed multi-paragraph summary covering what you changed, files touched, validation commands/results, remaining failures, and next steps.",
      keepToolsAfterFinal: true,
      temperature: 0,
      onEvent,
      onUsage,
    });

    let hadDirtyChanges = false;
    let pushed = false;
    let pushFailed = false;

    // Commit + push any edits so the open PR updates in place.
    const status = await runCommand(sandbox, "git status --porcelain", {
      cwd: workdir,
    });
    const dirty = status.stdout.trim();
    hadDirtyChanges = !!dirty;
    if (dirty) {
      const currentFingerprint = await workingTreeFingerprint(sandbox, workdir);
      const validatedCurrentTree =
        validation.passed && validation.fingerprint === currentFingerprint;

      if (!validatedCurrentTree) {
        const message = !validation.ran
          ? "The chat agent edited files but did not run validate_pr_branch, so no changes were pushed."
          : validation.passed
            ? "The chat agent changed files after the last passed validation, so no changes were pushed."
            : `Validation did not pass after the chat edits, so no changes were pushed. ${validation.summary ?? ""}`.trim();
        await prisma.agentRun
          .update({ where: { id: run.id }, data: { error: message } })
          .catch(() => {});
        await writeLog(ref, "AGENT_FILE", "ERROR", "verify_failed", message);
      } else {
        await runCommand(sandbox, `git add -A`, { cwd: workdir });
        await runCommand(sandbox, `git commit -m "fix: chat refinement"`, {
          cwd: workdir,
        });
        if (token) {
          await runCommand(
            sandbox,
            `git remote set-url origin https://x-access-token:${token}@github.com/${run.project.owner}/${run.project.name}.git`,
            { cwd: workdir },
          );
        }
        const pushCommand =
          target.mode === "FOLLOW_UP"
            ? `git push -u origin ${target.branch}`
            : `git push origin ${target.branch}`;
        const push = await runCommand(sandbox, pushCommand, {
          cwd: workdir,
          timeoutMs: 3 * 60 * 1000,
        });
        if (push.exitCode === 0) {
          pushed = true;
          if (target.mode === "FOLLOW_UP") {
            const pr = await openFollowUpPullRequest({
              run,
              branch: target.branch,
              token,
              previousPrUrl: target.previousPrUrl,
            });
            latestPrNumber = pr.prNumber;
            await prisma.agentRun
              .update({
                where: { id: run.id },
                data: {
                  branch: target.branch,
                  prUrl: pr.prUrl,
                  prNumber: pr.prNumber,
                  prState: "OPEN",
                  prMerged: false,
                  prOpenedAt: new Date(),
                  prMergedAt: null,
                  prClosedAt: null,
                  error: null,
                },
              })
              .catch(() => {});
            await writeLog(
              ref,
              "AGENT",
              "INFO",
              "pr_opened",
              `Opened a follow-up pull request: ${pr.prUrl}`,
              {
                prUrl: pr.prUrl,
                branch: target.branch,
                previousPrUrl: target.previousPrUrl,
              },
            );
          } else {
            await prisma.agentRun
              .update({ where: { id: run.id }, data: { error: null } })
              .catch(() => {});
            await writeLog(
              ref,
              "AGENT",
              "INFO",
              "pr_updated",
              "Pushed the change. The PR is updated.",
            );
          }
        } else {
          pushFailed = true;
          await writeLog(
            ref,
            "AGENT_FILE",
            "WARN",
            "push_failed",
            `Push failed: ${push.stderr.slice(0, 300)}`,
          );
        }
      }
    } else if (validation.required) {
      const message = validation.passed
        ? "Revalidation passed. No changes needed pushing."
        : validation.ran
          ? `Revalidation did not pass. ${validation.summary ?? ""}`.trim()
          : "Revalidation did not run validate_pr_branch.";
      await writeLog(
        ref,
        "AGENT_FILE",
        validation.passed ? "INFO" : "ERROR",
        validation.passed ? "validation_passed" : "verify_failed",
        message,
      );
      await prisma.agentRun
        .update({
          where: { id: run.id },
          data: { error: validation.passed ? null : message },
        })
        .catch(() => {});
    }

    // The agent's closing message.
    await writeLog(
      ref,
      "AGENT",
      "INFO",
      "agent_message",
      closingMessage({
        finalText: res.finalText,
        stoppedReason: res.stoppedReason,
        validation,
        repairMode,
        dirty: hadDirtyChanges,
        pushed,
        pushFailed,
      }).slice(0, FINAL_MESSAGE_CHARS),
    );

    // Reflect the latest PR state. A merge does not close the agent thread.
    if (latestPrNumber) {
      const pr = await getPrStatus(
        run.project.owner,
        run.project.name,
        latestPrNumber,
        token,
      );
      if (pr?.merged) {
        await prisma.agentRun.update({
          where: { id: run.id },
          data: { prMerged: true, prState: "MERGED", prMergedAt: new Date() },
        });
        await writeLog(
          ref,
          "AGENT",
          "INFO",
          "pr_merged",
          "The latest PR has been merged. Future messages will open a follow-up PR when changes are needed.",
        );
      } else if (pr?.state === "closed") {
        await prisma.agentRun.update({
          where: { id: run.id },
          data: { prMerged: false, prState: "CLOSED", prClosedAt: new Date() },
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.agentRun
      .update({ where: { id: input.agentRunId }, data: { error: message } })
      .catch(() => {});
    await writeLog(ref, "AGENT", "ERROR", "chat_failed", message);
  } finally {
    if (sandbox) {
      await refreshSandboxTimeout(sandbox, CHAT_SANDBOX_IDLE_TIMEOUT_MS).catch(
        () => {},
      );
    }
    // Keep the sandbox alive for the conversation; just return to PR_OPENED so
    // the chat composer re-enables and polling settles.
    await prisma.agentRun
      .update({
        where: { id: input.agentRunId },
        data: { status: "PR_OPENED" },
      })
      .catch(() => {});
  }
}

export async function releaseChatLockActivity(
  input: AgentChatWorkflowInput,
  reason: string,
): Promise<void> {
  const ref: LogRef = {
    agentRunId: input.agentRunId,
    projectId: input.projectId,
    userId: input.userId,
  };
  const message =
    reason || "The agent task stopped before it could finish cleanly.";

  await prisma.agentRun
    .update({
      where: { id: input.agentRunId },
      data: {
        status: "PR_OPENED",
        error: message,
      },
    })
    .catch(() => {});

  await writeLog(
    ref,
    "AGENT",
    "ERROR",
    input.kind === "REVALIDATE" ? "revalidation_failed" : "chat_failed",
    `The agent task stopped before it could finish: ${message}`,
  );
}
