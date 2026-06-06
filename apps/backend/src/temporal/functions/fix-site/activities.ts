import { prisma } from "@repo/db";
import { runAgent, type AgentStepLog, type AgentTool } from "@repo/ai";
import {
  createSandbox,
  connectSandbox,
  cloneRepo,
  runCommand,
  killSandbox,
  sandboxTools,
} from "@repo/sandbox";
import Secrets from "@repo/secrets/backend";
import type { FixClarificationRequest } from "@repo/types/fix";
import type { SiteReport } from "@repo/types/scraper";
import type { FixSiteInput } from "../../shared";
import { checkSite } from "../checkup/crawler";
import { buildFixPlan } from "./fix-plan";
import { resolveGitToken } from "./git-creds";
import { loadHarnessPrompt, loadSkill } from "./skills";
import {
  logEvent,
  setState,
  setSandbox,
  setError,
  refreshCounters,
  setPr,
  addCogs,
  recordSandboxCogs,
} from "./run-store";

const REPO_DIR = "/home/user/repo";

// Max harness passes per run: 1 initial + up to 2 budget-driven continuations.
const MAX_HARNESS_PASSES = 3;

type RunHarnessStop = "done" | "max_steps";

// The harness result the workflow records. Never throws — outcome is data.
export interface HarnessResult {
  ok: boolean;
  committed: boolean;
  prUrl: string | null;
  prNumber: number | null;
  fixedChecks: number;
  totalChecks: number;
  summary: string;
  error: string | null;
}

export interface PlannedFixTask {
  rubricId: string;
  category: string;
  scope: string;
  tier: string;
  affectedCount: number;
  skill: string | null;
}

export interface PlanRunResult {
  tasks: PlannedFixTask[];
  reportContext: PlanningReportContext;
}

export interface PlanningReportContext {
  website: string;
  overall: number;
  pagesChecked: number;
  websiteType: string;
  summary: SiteReport["summary"];
  findings: {
    id: string;
    category: string;
    tier: string;
    scope: string;
    siteStatus: string;
    affectedCount: number;
    representativeEvidence: string | null;
    pages: {
      url: string;
      status: string;
      evidence: string | null;
    }[];
  }[];
}

// ── 1. Scan + plan. Records the checks for the UI and emits the agent's
//      clarification request before any sandbox is created. ──────────────────
export async function planRun(input: FixSiteInput): Promise<PlanRunResult> {
  // Fresh authoritative scan -> fix plan.
  await setState(input.fixRunId, "SCANNING");
  await logEvent(input.fixRunId, "scan_started", null, {
    website: input.website,
  });

  const report = await checkSite(input.website, {
    // Stream the scan's real substeps to the UI (grouped under "Scanning…").
    // Skip per-page chatter; keep the meaningful phase/discovery/failure steps.
    progress: async (signal) => {
      if (signal.type === "page_started" || signal.type === "page_completed") {
        return;
      }
      await logEvent(input.fixRunId, "scan_progress", null, {
        phase: signal.phase,
        message: signal.message,
      });
    },
  });
  const plan = buildFixPlan(report.findings, {
    pagesChecked: report.crawl.pagesChecked,
  });
  const planTasks = [...plan.siteWide, ...plan.perPage];

  // Persist each task as a FixCheck (for the dashboard). The harness updates
  // these from its summary at the end.
  for (const t of planTasks) {
    await prisma.fixCheck.upsert({
      where: {
        fixRunId_rubricId: { fixRunId: input.fixRunId, rubricId: t.rubricId },
      },
      create: {
        fixRunId: input.fixRunId,
        rubricId: t.rubricId,
        category: t.category,
        scope: t.scope,
        tier: t.tier,
        weight: t.weight,
        affectedCount: t.affectedCount,
        status: "PENDING",
      },
      update: {},
    });
  }
  for (const f of plan.flagged) {
    await prisma.fixCheck.upsert({
      where: {
        fixRunId_rubricId: { fixRunId: input.fixRunId, rubricId: f.rubricId },
      },
      create: {
        fixRunId: input.fixRunId,
        rubricId: f.rubricId,
        category: "",
        scope: "per-page",
        tier: "out-of-scope",
        affectedCount: f.affectedCount,
        status: "FLAGGED",
        note: f.reason,
      },
      update: {},
    });
  }
  await refreshCounters(input.fixRunId);
  await logEvent(input.fixRunId, "plan_built", null, {
    siteWide: plan.totals.siteWide,
    perPage: plan.totals.perPage,
    flagged: plan.flagged.length,
  });

  const tasks = planTasks.map((t) => ({
    rubricId: t.rubricId,
    category: t.category,
    scope: t.scope,
    tier: t.tier,
    affectedCount: t.affectedCount,
    skill: loadSkill(t.rubricId),
  }));

  return { tasks, reportContext: buildPlanningReportContext(report) };
}

// ── 2. Sandbox + clone. Gets the repo onto a fix branch in a live sandbox.
//      Best-effort; only true infra errors throw so Temporal can retry. ───────
export async function prepareSandbox(input: FixSiteInput): Promise<{
  sandboxId: string;
  branch: string;
}> {
  const run = await prisma.fixRun.findUnique({
    where: { id: input.fixRunId },
    select: { sandboxId: true },
  });
  let sandboxId = run?.sandboxId ?? null;
  if (sandboxId) {
    try {
      const sb = await connectSandbox(sandboxId);
      if (!(await sb.isRunning())) sandboxId = null;
      else
        await logEvent(input.fixRunId, "sandbox_reconnected", null, {
          sandboxId,
        });
    } catch {
      sandboxId = null;
    }
  }
  if (!sandboxId) {
    await setState(input.fixRunId, "CLONING");
    await setSandbox(input.fixRunId, null, "CREATING");
    const sandbox = await createSandbox({ timeoutMs: 30 * 60 * 1000 });
    sandboxId = sandbox.sandboxId;
    await setSandbox(input.fixRunId, sandboxId, "RUNNING");
    await logEvent(input.fixRunId, "sandbox_created", null, { sandboxId });
  }

  const branch = `geo-repair/fix-${input.fixRunId.slice(0, 8)}`;
  const sandbox = await connectSandbox(sandboxId);

  // Clone (idempotent) + branch.
  const cloned = await runCommand(
    sandbox,
    `test -d ${REPO_DIR}/.git && echo yes || echo no`,
  );
  if (cloned.stdout.trim() !== "yes") {
    const token = await resolveGitToken(input.userId);
    const { result } = await cloneRepo(sandbox, {
      cloneUrl: input.cloneUrl,
      branch: input.defaultBranch,
      dir: REPO_DIR,
      token,
    });
    if (result.exitCode !== 0) {
      throw new Error(`git clone failed: ${result.stderr}`); // true infra error -> retry
    }
    await runCommand(sandbox, `git config user.email "bot@geo.repair"`, {
      cwd: REPO_DIR,
    });
    await runCommand(sandbox, `git config user.name "GEO Repair Bot"`, {
      cwd: REPO_DIR,
    });
    await logEvent(input.fixRunId, "repo_cloned", null, { branch });
  }
  await runCommand(sandbox, `git checkout -B ${branch}`, { cwd: REPO_DIR });

  return { sandboxId, branch };
}

function buildPlanningReportContext(report: SiteReport): PlanningReportContext {
  return {
    website: report.url,
    overall: report.overall,
    pagesChecked: report.crawl.pagesChecked,
    websiteType: report.siteInfo.websiteType,
    summary: report.summary,
    findings: report.findings
      .filter(
        (finding) =>
          finding.siteStatus === "fail" ||
          finding.siteStatus === "partial" ||
          finding.siteStatus === "mixed",
      )
      .map((finding) => ({
        id: finding.id,
        category: finding.category,
        tier: finding.tier,
        scope: finding.scope,
        siteStatus: finding.siteStatus,
        affectedCount: finding.affectedCount,
        representativeEvidence: finding.representativeEvidence,
        pages: finding.pages.slice(0, 5).map((page) => ({
          url: page.url,
          status: page.status,
          evidence: page.evidence,
        })),
      })),
  };
}

function planningTools(
  sandbox: Awaited<ReturnType<typeof connectSandbox>>,
): AgentTool[] {
  const baseTools = sandboxTools(sandbox, {
    workdir: REPO_DIR,
    maxOutputChars: 16_000,
  }) as unknown as AgentTool[];
  const readonlyTools = baseTools.filter((tool) =>
    ["list_dir", "read_file"].includes(tool.name),
  );

  return [
    ...readonlyTools,
    {
      name: "search_repo",
      description:
        "Search text in the repo with ripgrep. Read-only. Use this to locate routes, metadata, schema, CMS config, content files, and build scripts.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Literal text or regex." },
          path: {
            type: "string",
            description: "Relative path to search. Use '.' for repo root.",
          },
        },
        required: ["query"],
      },
      execute: async (args) => {
        const query = String(args.query ?? "");
        const path = String(args.path ?? ".");
        const res = await runCommand(
          sandbox,
          [
            "rg",
            "-n",
            "--hidden",
            "--glob",
            "'!node_modules'",
            "--glob",
            "'!.git'",
            shellQuote(query),
            shellQuote(path),
          ].join(" "),
          { cwd: REPO_DIR, timeoutMs: 60_000 },
        );
        const output = res.stdout || res.stderr || "(no matches)";
        return output.length > 16_000
          ? `${output.slice(0, 16_000)}\n...[truncated]`
          : output;
      },
    },
  ];
}

export async function runPlanningAgent(
  input: FixSiteInput,
  sandboxId: string,
  tasks: PlannedFixTask[],
  reportContext: PlanningReportContext,
): Promise<FixClarificationRequest | null> {
  if (tasks.length === 0) return null;

  await logEvent(input.fixRunId, "planning_agent_started", null, {
    checks: tasks.map((task) => task.rubricId),
  });

  const sandbox = await connectSandbox(sandboxId);
  const system = [
    "You are the GEO Repair planning agent.",
    "You inspect a cloned website repository before the execution agent edits it.",
    "Your only job is to decide which clarification questions are truly blocking.",
    "You are read-only in this pass. Do not edit files. Do not suggest code changes.",
    "Use at most 8 tool calls, then stop inspecting and return the JSON answer.",
    "Ask around 3 to 5 questions when clarification is useful. The hard maximum is 10 questions.",
    "Ask zero questions if the repo and report contain enough information for a safe small PR.",
    "Questions must be multiple choice with 2 to 4 options and may include an optional notes placeholder.",
    "For every question, pick the single safest, most sensible default and mark it as recommended by starting THAT option's label with 'Recommended: ' (e.g. 'Recommended: Static files in public/'). Exactly one option per question, and list it first.",
    "Only ask what the execution agent cannot safely infer from the repo, report, or existing site content.",
    "As you inspect, narrate briefly in plain language — a short, natural sentence before tool calls so the user can follow along. Vary your wording; do NOT start every line the same way (never repeat 'I am about to…').",
    "Your FINAL message must be only the JSON object: no markdown and no prose around it.",
  ].join("\n");
  const user = [
    `Repository: ${input.repoFullName}`,
    `Live site: ${input.website}`,
    `Default branch: ${input.defaultBranch}`,
    "",
    "Inspect the repo with the available read-only tools. Focus on content sources, app framework, metadata/schema ownership, design constraints, and facts needed for net-new content.",
    "",
    "Report context:",
    JSON.stringify(reportContext, null, 2),
    "",
    "Fix tasks:",
    JSON.stringify(
      tasks.map((task) => ({
        rubricId: task.rubricId,
        category: task.category,
        scope: task.scope,
        tier: task.tier,
        affectedCount: task.affectedCount,
      })),
      null,
      2,
    ),
    "",
    "Required JSON shape:",
    JSON.stringify(
      {
        summary:
          "Short first-person summary of what you inspected and why these questions are needed.",
        questions: [
          {
            id: "stable_snake_case_id",
            question: "Question text",
            notePlaceholder: "Optional notes placeholder",
            options: [
              {
                id: "stable_snake_case_option",
                label: "Short option label",
                description: "What this option means for the execution PR",
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  ].join("\n");

  const result = await runAgent({
    system,
    user,
    tools: planningTools(sandbox),
    maxSteps: 24,
    forceFinalAfterSteps: 8,
    finalInstruction:
      "Stop inspecting now. Return only the clarification JSON object, with around 3 to 5 questions and a hard maximum of 10.",
    maxTokens: 3000,
    temperature: 0.1,
    onEvent: async (log) => {
      await logEvent(input.fixRunId, `planning_agent_${log.type}`, null, {
        toolName: log.toolName,
        // Keep the agent's own words readable in the UI; cap noisy tool output.
        content: log.content?.slice(
          0,
          log.type === "assistant" ? 8000 : 2000,
        ),
        toolArgs: log.toolArgs,
      });
    },
  });

  await addCogs(
    input.fixRunId,
    result.tokensIn,
    result.tokensOut,
    Secrets.LLM_MODEL,
  );

  const clarificationRequest = parseClarificationRequest(result.finalText);
  if (!clarificationRequest) {
    // Clarifications are optional. If the planner couldn't produce valid
    // questions (e.g. it exhausted its tool budget), DON'T fail the whole run —
    // log it and proceed straight to the fix harness with no intake. The harness
    // is conservative by default when no clarification was submitted.
    await logEvent(input.fixRunId, "planning_agent_invalid_response", null, {
      response: result.finalText.slice(0, 1200),
      stoppedReason: result.stoppedReason,
    });
    return null;
  }

  if (!clarificationRequest.questions.length) {
    await logEvent(input.fixRunId, "planning_agent_no_questions", null, {
      summary: clarificationRequest.summary,
      stoppedReason: result.stoppedReason,
    });
    return null;
  }

  await logEvent(input.fixRunId, "agent_clarification_requested", null, {
    ...clarificationRequest,
  });
  await setState(input.fixRunId, "WAITING_FOR_INPUT");
  return clarificationRequest;
}

export async function failRun(
  input: FixSiteInput,
  error: string,
): Promise<void> {
  await setError(input.fixRunId, error);
}

function parseClarificationRequest(
  text: string,
): FixClarificationRequest | null {
  const parsed = parseJsonObject(text);
  if (!parsed) return null;

  const input = parsed as {
    summary?: unknown;
    questions?: unknown;
  };
  const questions = Array.isArray(input.questions)
    ? input.questions
        .map((question, index) => normalizeQuestion(question, index))
        .filter(
          (
            question,
          ): question is FixClarificationRequest["questions"][number] =>
            !!question,
        )
        .slice(0, 10)
    : [];

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    summary:
      typeof input.summary === "string" && input.summary.trim()
        ? input.summary.trim().slice(0, 500)
        : "The planning agent inspected the report and repository.",
    questions,
  };
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const direct = JSON.parse(text);
    return direct && typeof direct === "object" && !Array.isArray(direct)
      ? (direct as Record<string, unknown>)
      : null;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      const sliced = JSON.parse(text.slice(start, end + 1));
      return sliced && typeof sliced === "object" && !Array.isArray(sliced)
        ? (sliced as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

function normalizeQuestion(
  value: unknown,
  index: number,
): FixClarificationRequest["questions"][number] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value as {
    id?: unknown;
    question?: unknown;
    notePlaceholder?: unknown;
    options?: unknown;
  };
  if (typeof input.question !== "string" || !input.question.trim()) {
    return null;
  }

  const options = Array.isArray(input.options)
    ? input.options
        .map((option, optionIndex) => normalizeOption(option, optionIndex))
        .filter(
          (
            option,
          ): option is FixClarificationRequest["questions"][number]["options"][number] =>
            !!option,
        )
        .slice(0, 4)
    : [];
  if (options.length < 2) return null;

  return {
    id:
      typeof input.id === "string" && input.id.trim()
        ? slugId(input.id)
        : `agent_question_${index + 1}`,
    question: input.question.trim().slice(0, 240),
    notePlaceholder:
      typeof input.notePlaceholder === "string" &&
      input.notePlaceholder.trim()
        ? input.notePlaceholder.trim().slice(0, 180)
        : "Add details the agent should follow.",
    options,
  };
}

function normalizeOption(
  value: unknown,
  index: number,
): FixClarificationRequest["questions"][number]["options"][number] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value as {
    id?: unknown;
    label?: unknown;
    description?: unknown;
  };
  if (typeof input.label !== "string" || !input.label.trim()) return null;

  return {
    id:
      typeof input.id === "string" && input.id.trim()
        ? slugId(input.id)
        : `option_${index + 1}`,
    label: input.label.trim().slice(0, 80),
    description:
      typeof input.description === "string" && input.description.trim()
        ? input.description.trim().slice(0, 240)
        : input.label.trim().slice(0, 120),
  };
}

function slugId(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "item"
  );
}

// ── 3. The harness: ONE autonomous agent with full sandbox access. Explores,
//      fixes the failing checks, commits. Wraps everything so it NEVER throws —
//      whatever happens, it returns a structured result the workflow records. ─
export async function runHarness(
  input: FixSiteInput,
  sandboxId: string,
  tasks: PlannedFixTask[],
): Promise<{ committed: boolean; summary: string }> {
  await setState(input.fixRunId, "FIXING");
  await logEvent(input.fixRunId, "harness_started", null, {
    checks: tasks.map((t) => t.rubricId),
  });

  try {
    const sandbox = await connectSandbox(sandboxId);
    const tools = sandboxTools(sandbox, {
      workdir: REPO_DIR,
    }) as unknown as AgentTool[];

    // Build the goal: the failing checks + their skills (guidance, not a rigid
    // per-check loop). The agent decides how to apply them to THIS repo.
    const checkBlocks = tasks
      .map((t) => {
        const head = `### ${t.rubricId} (${t.category}, ${t.scope})`;
        return t.skill
          ? `${head}\n${t.skill}`
          : `${head}\n(no skill doc — use judgment or flag)`;
      })
      .join("\n\n");

    const system = loadHarnessPrompt();
    const initialUser = [
      `Repository: ${input.repoFullName}`,
      `Live site: ${input.website}`,
      `Default branch: ${input.defaultBranch}`,
      `You are already on the fix branch in a fresh clone at the repo root.`,
      ``,
      `## User clarification intake`,
      `Use these answers as hard scope and preference constraints. If a user did not opt into net-new claims, content, competitor pages, or visual changes, do not create them.`,
      ``,
      intakePromptBlock(input),
      ``,
      `## Failing checks to fix`,
      `Here are the GEO/AEO checks that failed, each with a skill doc describing the pass bar`,
      `and per-framework fixes. Apply them to this project's ACTUAL structure (explore first).`,
      ``,
      checkBlocks,
      ``,
      `Begin by exploring the repo, then fix what you can, then commit with git add -A && git commit.`,
    ].join("\n");

    const onAgentEvent = async (log: AgentStepLog) => {
      await logEvent(input.fixRunId, `agent_${log.type}`, null, {
        toolName: log.toolName,
        // Keep the agent's own words readable in the UI; cap noisy tool output.
        content: log.content?.slice(0, log.type === "assistant" ? 8000 : 2000),
        toolArgs: log.toolArgs,
      });
    };

    // Budget is a STOP condition, never a hard failure. If a pass exhausts its
    // step budget (stoppedReason "max_steps") with work likely remaining, run a
    // bounded number of continuation passes on the SAME sandbox — the repo's git
    // state carries the progress, so the agent continues rather than restarting.
    // We stop when the agent finishes on its own, a pass makes no new commit, or
    // we hit the pass cap.
    let summary = "";
    let stoppedReason: RunHarnessStop = "done";
    let prevCommitCount = -1;

    for (let pass = 1; pass <= MAX_HARNESS_PASSES; pass++) {
      const continuation = pass > 1;
      const maxSteps = continuation ? 60 : 80;

      if (continuation) {
        await logEvent(input.fixRunId, "harness_continued", null, { pass });
      }

      const result = await runAgent({
        system,
        user: continuation
          ? await continuationPrompt(sandbox, input, checkBlocks)
          : initialUser,
        tools,
        maxSteps,
        maxTokens: 8000,
        // Nudge it to commit before the wall, but keep tools so it actually can.
        forceFinalAfterSteps: maxSteps - 8,
        keepToolsAfterFinal: true,
        finalInstruction:
          "You are almost out of budget for this pass. Make only the most essential remaining edits, then immediately run `git add -A && git commit`, then stop.",
        onEvent: onAgentEvent,
      });

      await addCogs(
        input.fixRunId,
        result.tokensIn,
        result.tokensOut,
        Secrets.LLM_MODEL,
      );
      summary = result.finalText || summary;
      stoppedReason = result.stoppedReason;

      const passCommitCount = await getCommitCount(sandbox, input.defaultBranch);
      // The agent decided it was done — no more passes.
      if (stoppedReason === "done") break;
      // A continuation that produced no new commit isn't progressing — stop.
      if (continuation && passCommitCount === prevCommitCount) break;
      prevCommitCount = passCommitCount;
    }

    // Safety net: never drop paid work — commit anything left in the tree.
    const dirty = await runCommand(sandbox, `git status --porcelain`, {
      cwd: REPO_DIR,
    });
    if (dirty.stdout.trim()) {
      await runCommand(
        sandbox,
        `git add -A && git commit -m "fix: GEO/AEO readiness improvements (auto-saved)"`,
        { cwd: REPO_DIR },
      );
    }

    const commitCount = await getCommitCount(sandbox, input.defaultBranch);
    const committed = commitCount > 0;

    if (committed) {
      await logEvent(
        input.fixRunId,
        "diff_summary",
        null,
        await collectDiffSummary(sandbox, input.defaultBranch),
      );
    }

    // Best-effort: reflect the agent's summary onto the FixCheck rows.
    await applySummaryToChecks(input.fixRunId, summary, tasks, committed);

    await logEvent(input.fixRunId, "harness_finished", null, {
      committed,
      commitCount,
      stoppedReason,
    });

    return { committed, summary };
  } catch (err) {
    // The agent harness must never crash the run — record and continue.
    const msg = err instanceof Error ? err.message : String(err);
    await logEvent(input.fixRunId, "harness_error", null, { error: msg });
    return { committed: false, summary: `Harness error: ${msg}` };
  }
}

// Mark checks fixed/skipped from the agent's free-text summary (heuristic).
async function applySummaryToChecks(
  fixRunId: string,
  summary: string,
  tasks: Pick<PlannedFixTask, "rubricId">[],
  committed: boolean,
): Promise<void> {
  const lower = summary.toLowerCase();
  for (const t of tasks) {
    const id = t.rubricId.toLowerCase();
    // If the summary mentions the check under a "fixed" context and we committed,
    // mark it FIXED; otherwise SKIPPED. This is display-only; the PR diff is truth.
    const mentioned = lower.includes(id);
    const fixed =
      committed &&
      mentioned &&
      !/\bskip|already|flag/.test(sliceAround(lower, id));
    await prisma.fixCheck.update({
      where: { fixRunId_rubricId: { fixRunId, rubricId: t.rubricId } },
      data: {
        status: fixed ? "FIXED" : "SKIPPED",
        fixed,
        note: mentioned ? "see PR summary" : "not addressed",
      },
    });
  }
  await refreshCounters(fixRunId);
}

function sliceAround(text: string, needle: string): string {
  const i = text.indexOf(needle);
  if (i < 0) return "";
  return text.slice(Math.max(0, i - 40), i + 80);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

async function getCommitCount(
  sandbox: Awaited<ReturnType<typeof connectSandbox>>,
  defaultBranch: string,
): Promise<number> {
  const res = await runCommand(
    sandbox,
    `git rev-list --count ${shellQuote(`${defaultBranch}..HEAD`)} 2>/dev/null || echo 0`,
    { cwd: REPO_DIR },
  );
  return parseInt(res.stdout.trim() || "0", 10);
}

// Prompt for a continuation pass: hand the agent its own committed + uncommitted
// progress so it picks up where it left off instead of starting over.
async function continuationPrompt(
  sandbox: Awaited<ReturnType<typeof connectSandbox>>,
  input: FixSiteInput,
  checkBlocks: string,
): Promise<string> {
  const range = shellQuote(`${input.defaultBranch}..HEAD`);
  const [stat, status] = await Promise.all([
    runCommand(sandbox, `git diff --stat ${range}`, { cwd: REPO_DIR }),
    runCommand(sandbox, `git status --porcelain`, { cwd: REPO_DIR }),
  ]);

  return [
    `Repository: ${input.repoFullName}`,
    `Live site: ${input.website}`,
    `You are CONTINUING an in-progress fix on the same branch — you ran low on budget on the previous pass. Build on what's already there; do not start over.`,
    ``,
    `## Already committed so far`,
    stat.stdout.trim() ? stat.stdout.slice(0, 4000) : "(nothing committed yet)",
    ``,
    `## Uncommitted changes in the working tree`,
    status.stdout.trim() ? status.stdout.slice(0, 4000) : "(working tree clean)",
    ``,
    `## Finish the remaining failing checks`,
    `Apply the ones below that aren't done yet, then commit. Skip anything already handled.`,
    ``,
    checkBlocks,
    ``,
    `Commit your progress with git add -A && git commit before you run out of budget.`,
  ].join("\n");
}

async function collectDiffSummary(
  sandbox: Awaited<ReturnType<typeof connectSandbox>>,
  defaultBranch: string,
): Promise<Record<string, unknown>> {
  const range = shellQuote(`${defaultBranch}..HEAD`);
  const [stat, nameStatus, patch] = await Promise.all([
    runCommand(sandbox, `git diff --stat ${range}`, { cwd: REPO_DIR }),
    runCommand(sandbox, `git diff --name-status ${range}`, { cwd: REPO_DIR }),
    runCommand(
      sandbox,
      `git diff --no-ext-diff --unified=3 ${range} | head -c 24000`,
      {
        cwd: REPO_DIR,
        timeoutMs: 60_000,
      },
    ),
  ]);

  return {
    stat: stat.stdout.slice(0, 8000),
    nameStatus: nameStatus.stdout.slice(0, 8000),
    patch: patch.stdout.slice(0, 24000),
    truncated: patch.stdout.length >= 24000,
  };
}

function intakePromptBlock(input: FixSiteInput): string {
  if (!input.intake?.answers.length) {
    return "No structured clarification intake was submitted.";
  }

  return input.intake.answers
    .map((answer) =>
      [
        `- ${answer.question}`,
        `  Answer: ${answer.answerLabel}`,
        answer.notes ? `  Notes: ${answer.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
}

// GitHub REST helpers for opening the PR with a fork fallback. A token that can
// write the base repo (the owner's OAuth token) opens the PR directly; a token
// that can't (a service account) forks, pushes to the fork, and opens a
// cross-fork PR. Cross-fork PRs into a public base need a classic token with
// `public_repo`/`repo` scope; a fine-grained PAT scoped to other repos can't.
function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "geo-repair",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function githubLogin(token: string): Promise<string> {
  const res = await fetch("https://api.github.com/user", {
    headers: ghHeaders(token),
  });
  const j = (await res.json()) as { login?: string };
  if (!res.ok || !j.login)
    throw new Error(`github whoami failed: ${res.status}`);
  return j.login;
}

async function ensureFork(
  token: string,
  repoFullName: string,
  login: string,
): Promise<string> {
  const repoName = repoFullName.split("/")[1] ?? repoFullName;
  const forkFull = `${login}/${repoName}`;
  const existing = await fetch(`https://api.github.com/repos/${forkFull}`, {
    headers: ghHeaders(token),
  });
  if (existing.ok) return forkFull;
  await fetch(`https://api.github.com/repos/${repoFullName}/forks`, {
    method: "POST",
    headers: ghHeaders(token),
    body: "{}",
  });
  // Forking is async; poll until the fork is queryable (max ~30s).
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const check = await fetch(`https://api.github.com/repos/${forkFull}`, {
      headers: ghHeaders(token),
    });
    if (check.ok) return forkFull;
  }
  throw new Error("fork did not become ready in time");
}

async function createPr(
  token: string,
  repoFullName: string,
  payload: {
    head: string;
    base: string;
    title: string;
    body: string;
    maintainer_can_modify?: boolean;
  },
): Promise<{
  ok: boolean;
  htmlUrl?: string;
  number?: number;
  message?: string;
  status: number;
}> {
  const res = await fetch(
    `https://api.github.com/repos/${repoFullName}/pulls`,
    {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify(payload),
    },
  );
  const j = (await res.json()) as {
    number?: number;
    html_url?: string;
    message?: string;
  };
  return {
    ok: res.ok && !!j.html_url && !!j.number,
    htmlUrl: j.html_url,
    number: j.number,
    message: j.message,
    status: res.status,
  };
}

async function pushAndOpenPr(opts: {
  sandbox: Awaited<ReturnType<typeof connectSandbox>>;
  token: string;
  repoFullName: string;
  cloneUrl: string;
  branch: string;
  defaultBranch: string;
  title: string;
  body: string;
  onEvent: (type: string, payload: Record<string, unknown>) => Promise<void>;
}): Promise<{ prUrl: string; prNumber: number; viaFork: boolean }> {
  const {
    sandbox,
    token,
    repoFullName,
    branch,
    defaultBranch,
    title,
    body,
    onEvent,
  } = opts;
  const baseAuthUrl = opts.cloneUrl.replace(
    "https://",
    `https://x-access-token:${token}@`,
  );

  // 1. Direct path: push to the base repo and open a same-repo PR.
  const directPush = await runCommand(
    sandbox,
    `git push ${baseAuthUrl} ${branch} --force`,
    {
      cwd: REPO_DIR,
      timeoutMs: 5 * 60 * 1000,
    },
  );
  if (directPush.exitCode === 0) {
    await onEvent("branch_pushed", { branch, target: "base" });
    const pr = await createPr(token, repoFullName, {
      head: branch,
      base: defaultBranch,
      title,
      body,
    });
    if (pr.ok)
      return { prUrl: pr.htmlUrl!, prNumber: pr.number!, viaFork: false };
    await onEvent("direct_pr_failed", {
      status: pr.status,
      message: pr.message ?? null,
    });
    // Branch is on the base but the PR was refused — fall through to the fork path.
  } else {
    await onEvent("direct_push_failed", {
      detail: directPush.stderr.slice(-300),
    });
  }

  // 2. Fork path: fork into the token account, push there, open a cross-fork PR.
  const login = await githubLogin(token);
  const forkFull = await ensureFork(token, repoFullName, login);
  await onEvent("fork_ready", { fork: forkFull });
  const forkUrl = `https://x-access-token:${token}@github.com/${forkFull}.git`;
  const forkPush = await runCommand(
    sandbox,
    `git push ${forkUrl} ${branch} --force`,
    {
      cwd: REPO_DIR,
      timeoutMs: 5 * 60 * 1000,
    },
  );
  if (forkPush.exitCode !== 0) {
    throw new Error(`push to fork failed: ${forkPush.stderr.slice(-400)}`);
  }
  await onEvent("branch_pushed", { branch, target: "fork" });
  const pr = await createPr(token, repoFullName, {
    head: `${login}:${branch}`,
    base: defaultBranch,
    title,
    body,
    maintainer_can_modify: true,
  });
  if (!pr.ok) {
    throw new Error(`open cross-fork PR failed: ${pr.message ?? pr.status}`);
  }
  return { prUrl: pr.htmlUrl!, prNumber: pr.number!, viaFork: true };
}

// ── 3. Finalize: push the branch + open the PR if there's a commit. Records the
//      outcome. NEVER throws — a push/PR failure becomes a recorded error, not a
//      workflow crash. ─────────────────────────────────────────────────────────
export async function finalizeRun(
  input: FixSiteInput,
  sandboxId: string,
  committed: boolean,
  summary: string,
): Promise<HarnessResult> {
  const counts = await prisma.fixCheck.findMany({
    where: { fixRunId: input.fixRunId },
    select: { rubricId: true, status: true, fixed: true, note: true },
  });
  const fixedChecks = counts.filter((c) => c.fixed).length;
  const totalChecks = counts.length;

  if (!committed) {
    await prisma.fixRun.update({
      where: { id: input.fixRunId },
      data: { state: "COMPLETED" },
    });
    await logEvent(input.fixRunId, "no_changes", null, {
      summary: summary.slice(0, 500),
    });
    return {
      ok: true,
      committed: false,
      prUrl: null,
      prNumber: null,
      fixedChecks,
      totalChecks,
      summary,
      error: null,
    };
  }

  try {
    await setState(input.fixRunId, "PUSHING");
    const sandbox = await connectSandbox(sandboxId);
    const token = await resolveGitToken(input.userId);
    const branch = `geo-repair/fix-${input.fixRunId.slice(0, 8)}`;

    const fixed = counts.filter((c) => c.fixed);
    const flagged = counts.filter((c) => c.status === "FLAGGED");
    const body = [
      "## GEO Repair — automated fixes",
      "",
      summary,
      "",
      "### Checks",
      ...(fixed.length
        ? fixed.map((c) => `- fixed: \`${c.rubricId}\``)
        : ["- (see summary)"]),
      ...flagged.map((c) => `- flagged: \`${c.rubricId}\` ${c.note ?? ""}`),
      "",
      "These changes improve technical GEO/AEO readiness. They do not guarantee traffic, rankings, or AI citations.",
    ].join("\n");

    const { prUrl, prNumber, viaFork } = await pushAndOpenPr({
      sandbox,
      token,
      repoFullName: input.repoFullName,
      cloneUrl: input.cloneUrl,
      branch,
      defaultBranch: input.defaultBranch,
      title: "GEO Repair: AI search readiness fixes",
      body,
      onEvent: (type, payload) => logEvent(input.fixRunId, type, null, payload),
    });

    await setPr(input.fixRunId, branch, prUrl, prNumber);
    await logEvent(input.fixRunId, "pr_strategy", null, { viaFork });
    return {
      ok: true,
      committed: true,
      prUrl,
      prNumber,
      fixedChecks,
      totalChecks,
      summary,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setError(input.fixRunId, msg);
    return {
      ok: false,
      committed: true,
      prUrl: null,
      prNumber: null,
      fixedChecks,
      totalChecks,
      summary,
      error: msg,
    };
  }
}

// ── 4. Teardown. Always called; never throws. ───────────────────────────────
export async function teardownSandbox(
  input: FixSiteInput,
  sandboxId: string,
): Promise<void> {
  try {
    const sandbox = await connectSandbox(sandboxId);
    await killSandbox(sandbox);
  } catch {
    // already gone
  }
  await setSandbox(input.fixRunId, sandboxId, "KILLED");
  const cogs = await recordSandboxCogs(input.fixRunId, sandboxId);
  await logEvent(input.fixRunId, "sandbox_killed", null, {
    sandboxId,
    sandboxSeconds: cogs?.sandboxSeconds ?? null,
    sandboxCostCents: cogs?.sandboxCostCents ?? null,
  });
}
