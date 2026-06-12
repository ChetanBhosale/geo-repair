import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import { createSandbox, cloneRepo, killSandbox, sandboxTools } from "@repo/sandbox";
import { runAgent, DEFAULT_MODEL, type AgentTool, type AgentStepLog } from "@repo/ai";
import { planCheck } from "./planner";
import type { PlanCheckInput, PlannedCheck } from "./types";
import type { AgentPlanWorkflowInput } from "./workflow-types";
import { sendFixFailedEmail, sendFixPlanReadyEmail } from "../../../lib/email-notifications";

// ---------------------------------------------------------------------------
// Logging: append a chat/activity row. A monotonic seq per run keeps order even
// when rows are written in the same millisecond.
// ---------------------------------------------------------------------------

interface LogRef {
  agentRunId: string;
  projectId: string;
  userId: string;
}

function makeLogger(ref: LogRef) {
  let seq = 0;
  return async (
    event: string,
    message: string,
    opts: { level?: "INFO" | "WARN" | "ERROR"; agentPlanId?: string; data?: Prisma.InputJsonValue } = {},
  ) => {
    await prisma.log
      .create({
        data: {
          source: "AGENT",
          level: opts.level ?? "INFO",
          event,
          message,
          seq: seq++,
          data: opts.data,
          agentRunId: ref.agentRunId,
          agentPlanId: opts.agentPlanId,
          projectId: ref.projectId,
          userId: ref.userId,
        },
      })
      .catch(() => {
        /* logging is best-effort */
      });
  };
}

// ---------------------------------------------------------------------------
// Planner agent prompt (repo-grounded, multi-check). Returns ONE JSON object.
// ---------------------------------------------------------------------------

const PLANNER_AGENT_SYSTEM = `You are the GEO Repair planning agent, running headless in a sandbox on a fresh clone of the user's website repository. A scan has already graded the live site against our GEO/AEO/SEO rubric and handed you the failing checks. Your job: understand THIS repo and decide how each failing check would be taken to a full pass.

You have READ-ONLY tools: list_dir, read_file, run_command (use it for grep/rg/ls/cat to search the repo). Do NOT modify anything in this pass.

Work like this:
1. Detect the framework/stack and where content lives (read package.json, find the shared layout/head, locate robots.txt / sitemap.xml / llms.txt).
2. For each failing check, look at the real files that would change.
3. Decide each check's path: AUTO (safe markup/structural fix over existing content, no user input), NEEDS_INPUT (net-new content or a judgment only the user can make), or MANUAL (impossible to do safely in code).

Think out loud: before a tool call drop ONE short, natural, jargon-free sentence about what you're doing (these stream live to the user). Vary your phrasing.

When you are done inspecting, STOP using tools and return ONLY this JSON object (no markdown, no prose around it):
{
  "summary": "first-person summary of the stack you found and the overall fix strategy",
  "plans": [
    {
      "rubricId": "<check id>",
      "mode": "AUTO" | "NEEDS_INPUT" | "MANUAL",
      "approach": "the exact change that makes this check pass",
      "targetPages": [{ "url": "<affected url or repo route>", "action": "modify"|"create"|"delete", "reason": "why" }],
      "question": "only for NEEDS_INPUT: the yes/no question, else null",
      "options": "only for NEEDS_INPUT: [{\\"id\\":\\"yes_existing|yes_provided|yes|no\\",\\"label\\":\\"...\\",\\"description\\":\\"...\\"}], else null"
    }
  ],
  "newPages": [
    {
      "title": "human title of a NEW page that does not exist yet but would lift AI citations",
      "kind": "comparison" | "faq" | "glossary" | "about" | "data" | "guide",
      "path": "suggested route, e.g. /compare/acme-vs-competitor",
      "reason": "why this page would help (tie to the gap you saw)",
      "question": "Create this page? (yes/no)",
      "options": [{"id":"yes_existing","label":"...","description":"..."},{"id":"yes_provided","label":"...","description":"..."},{"id":"no","label":"...","description":"..."}]
    }
  ],
  "manual": [{ "rubricId": "<id>", "reason": "why it can't be fixed in code" }]
}

Include one plans[] entry for EVERY failing check given (except those you put in manual). Never invent claims, content, or sources.

newPages (be realistic and proactive): beyond fixing the failing checks, propose 0-3 HIGH-VALUE pages that DO NOT exist on this site yet but would materially improve how often AI engines cite it. Only propose a page when there is a real gap and clear value, and never one that already exists. Evidence to prioritise by: comparison / "X vs Y" pages earn around 32% more AI citations; original-data pages (surveys, benchmarks, real numbers) make the site the cited source; FAQ and glossary pages give answer engines extractable Q&A and plain definitions; an about/contact page strengthens E-E-A-T. Each newPages item is gated: it is presented to the user as a yes/no with options yes_existing (build only from content already on the site), yes_provided (the user will paste the facts), and no (skip). NEVER invent facts, statistics, pricing, or competitor claims; these pages can only be built from content already on the site or details the user provides. If there are no genuinely valuable missing pages, return an empty newPages array.

The user can ONLY reply with text. NEVER ask them to upload or attach a file, document, or image (it is not supported). If a check needs an image (Open Graph image, logo, favicon), ask the user to paste an image URL in their note, or offer to generate one. Always request a URL or plain text, never an upload.`;

interface ParsedPlanItem {
  rubricId?: string;
  mode?: string;
  approach?: string;
  targetPages?: { url: string; action: "modify" | "create" | "delete"; reason: string }[];
  question?: string | null;
  options?: { id: string; label: string; description?: string }[] | null;
}
interface ParsedNewPage {
  title?: string;
  kind?: string; // comparison | faq | glossary | about | data | guide
  path?: string;
  reason?: string;
  question?: string | null;
  options?: { id: string; label: string; description?: string }[] | null;
}
interface ParsedPlan {
  summary?: string;
  plans?: ParsedPlanItem[];
  newPages?: ParsedNewPage[];
  manual?: { rubricId: string; reason: string }[];
}

function parsePlanJson(raw: string): ParsedPlan | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "");
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as ParsedPlan;
    } catch {
      return null;
    }
  };
  return (
    tryParse(trimmed) ??
    (() => {
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      return start !== -1 && end > start ? tryParse(trimmed.slice(start, end + 1)) : null;
    })()
  );
}

function buildUserMessage(checks: PlanCheckInput[], websiteUrl: string, repoFullName: string): string {
  return [
    `Website: ${websiteUrl}`,
    `Repository: ${repoFullName} (cloned at the current working directory)`,
    ``,
    `Failing checks to plan (${checks.length}):`,
    JSON.stringify(checks, null, 2),
    ``,
    `Inspect the repo, then return the JSON plan object.`,
  ].join("\n");
}

// Turn the model's parsed plan into PlannedCheck[], grounding each entry in the
// scan metadata and filling gaps deterministically. Every input check is
// represented exactly once.
function mapParsedToPlanned(parsed: ParsedPlan, checks: PlanCheckInput[]): PlannedCheck[] {
  const byId = new Map(checks.map((c) => [c.rubricId, c]));
  const manualIds = new Set((parsed.manual ?? []).map((m) => m.rubricId));
  const out: PlannedCheck[] = [];
  const seen = new Set<string>();

  for (const m of parsed.manual ?? []) {
    if (!byId.has(m.rubricId) || seen.has(m.rubricId)) continue;
    seen.add(m.rubricId);
    out.push({ kind: "manual", rubricId: m.rubricId, reason: m.reason });
  }

  for (const item of parsed.plans ?? []) {
    const check = item.rubricId ? byId.get(item.rubricId) : undefined;
    if (!check || seen.has(check.rubricId) || manualIds.has(check.rubricId)) continue;
    seen.add(check.rubricId);
    const mode = (item.mode ?? "AUTO").toUpperCase();
    if (mode === "MANUAL") {
      out.push({ kind: "manual", rubricId: check.rubricId, reason: item.approach ?? check.summary });
      continue;
    }
    out.push({
      kind: "check",
      rubricId: check.rubricId,
      category: check.category,
      tier: check.tier,
      weight: check.weight,
      scanStatus: check.scanStatus,
      fixableByAgent: check.fixableByAgent,
      evidence: check.evidence,
      recommendation: check.recommendation,
      mode: mode === "NEEDS_INPUT" ? "NEEDS_INPUT" : "AUTO",
      approach: item.approach ?? check.summary,
      targetPages: item.targetPages ?? [],
      question: item.question ?? null,
      options: item.options ?? null,
    });
  }

  // Any check the model skipped -> deterministic fallback so nothing is lost.
  for (const c of checks) {
    if (!seen.has(c.rubricId)) out.push(planCheck(c));
  }

  // Net-new page proposals (Tier C, gated). Not scan checks — they get a unique
  // synthetic rubricId (unique per plan is required by the DB), weight 0 (not
  // scored), and are always NEEDS_INPUT so the user explicitly approves them.
  const usedIds = new Set(out.map((p) => p.rubricId));
  for (const np of parsed.newPages ?? []) {
    if (!np.title && !np.path) continue;
    const kind = (np.kind ?? "page").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "page";
    let id = `new-page-${kind}`;
    let n = 2;
    while (usedIds.has(id)) id = `new-page-${kind}-${n++}`;
    usedIds.add(id);

    const title = np.title ?? `New ${kind} page`;
    const path = np.path ?? "";
    const reason = np.reason ?? `A new ${kind} page would improve how often AI engines cite this site.`;
    const options =
      np.options && np.options.length
        ? np.options
        : [
            {
              id: "yes_existing",
              label: "Yes, build it from content already on my site",
              description: "Only uses facts already published here; nothing invented.",
            },
            {
              id: "yes_provided",
              label: "Yes, and I'll provide the details",
              description: "Paste the facts/numbers in your note; the agent writes it in your voice.",
            },
            {
              id: "no",
              label: "No, skip this page",
              description: "Recorded as declined; nothing is created.",
            },
          ];

    out.push({
      kind: "check",
      rubricId: id,
      category: "Content",
      tier: "C",
      weight: 0,
      scanStatus: "FAILED",
      fixableByAgent: "true",
      evidence: null,
      recommendation: reason,
      mode: "NEEDS_INPUT",
      approach: `Create "${title}"${path ? ` at ${path}` : ""}. ${reason}`,
      targetPages: path ? [{ url: path, action: "create", reason }] : [],
      question: np.question ?? `Create a new "${title}" page? It can increase how often AI engines cite you.`,
      options,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Persist + fail helpers (plain functions; called inside the activity).
// ---------------------------------------------------------------------------

async function persistPlan(args: {
  agentRunId: string;
  agentPlanId: string;
  projectId: string;
  userId: string;
  summary: string;
  planned: PlannedCheck[];
  log: ReturnType<typeof makeLogger>;
}): Promise<{ checks: number; manual: number }> {
  const checks = args.planned.filter(
    (p): p is Extract<PlannedCheck, { kind: "check" }> => p.kind === "check",
  );
  const manual = args.planned.filter(
    (p): p is Extract<PlannedCheck, { kind: "manual" }> => p.kind === "manual",
  );

  await prisma.$transaction(
    checks.map((c, i) =>
      prisma.agentPlanCheck.create({
        data: {
          agentPlanId: args.agentPlanId,
          rubricId: c.rubricId,
          category: c.category,
          tier: c.tier,
          weight: c.weight,
          scanStatus: c.scanStatus,
          fixableByAgent: c.fixableByAgent,
          evidence: c.evidence,
          recommendation: c.recommendation,
          mode: c.mode,
          approach: c.approach,
          targetPages: c.targetPages as unknown as Prisma.InputJsonValue,
          question: c.question,
          options: (c.options ?? undefined) as unknown as Prisma.InputJsonValue,
          seq: i,
        },
      }),
    ),
  );

  await prisma.agentPlan.update({
    where: { id: args.agentPlanId },
    data: {
      status: "AWAITING_USER",
      summary: args.summary,
      manual: manual as unknown as Prisma.InputJsonValue,
    },
  });
  await prisma.agentRun.update({
    where: { id: args.agentRunId },
    data: { status: "AWAITING_INPUT" },
  });

  // The single plan-card message (anchored via agentPlanId). This is the last
  // chat message; the UI renders the interactive plan here.
  await args.log("plan_proposed", args.summary, {
    agentPlanId: args.agentPlanId,
    data: { planId: args.agentPlanId, checks: checks.length, manual: manual.length },
  });

  await prisma.workerStatus.updateMany({
    where: { temporalWorkflowId: `agent-plan-${args.agentRunId}` },
    data: { status: "COMPLETED", finishedAt: new Date() },
  });

  await sendFixPlanReadyEmail(args.agentRunId, checks.length).catch((err) => {
    console.error("[email] fix plan notification failed:", err);
  });

  return { checks: checks.length, manual: manual.length };
}

async function failPlan(ref: LogRef & { agentPlanId: string }, message: string) {
  await prisma.agentPlan.update({ where: { id: ref.agentPlanId }, data: { status: "FAILED" } }).catch(() => {});
  await prisma.agentRun
    .update({ where: { id: ref.agentRunId }, data: { status: "FAILED", error: message, finishedAt: new Date() } })
    .catch(() => {});
  await prisma.workerStatus
    .updateMany({
      where: { temporalWorkflowId: `agent-plan-${ref.agentRunId}` },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    })
    .catch(() => {});
  await prisma.log
    .create({
      data: {
        source: "AGENT",
        level: "ERROR",
        event: "plan_failed",
        message,
        agentRunId: ref.agentRunId,
        agentPlanId: ref.agentPlanId,
        projectId: ref.projectId,
        userId: ref.userId,
      },
    })
    .catch(() => {});
  await sendFixFailedEmail(ref.agentRunId, message).catch((err) => {
    console.error("[email] plan failure notification failed:", err);
  });
}

function hasAiKey(): boolean {
  // chat()/runAgent throw if OPEN_ROUTER_KEY is missing; check once up front.
  // (Secrets is read lazily in @repo/ai; we mirror the env check here.)
  return !!process.env.OPEN_ROUTER_KEY;
}

// ---------------------------------------------------------------------------
// The one activity: create sandbox -> clone -> inspect + plan with the agent
// (streaming logs) -> persist -> kill sandbox + clear sandboxId.
// ---------------------------------------------------------------------------

export async function runPlannerAgentActivity(
  input: AgentPlanWorkflowInput,
): Promise<{ checks: number; manual: number }> {
  const ref: LogRef = { agentRunId: input.agentRunId, projectId: input.projectId, userId: input.userId };
  const log = makeLogger(ref);

  let sandbox: Awaited<ReturnType<typeof createSandbox>> | null = null;

  try {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, userId: input.userId },
      include: { account: { select: { accessToken: true } } },
    });

    // 1. Create the sandbox.
    await log("sandbox_creating", "Spinning up a fresh sandbox to inspect your repository...");
    sandbox = await createSandbox();
    await prisma.agentRun.update({
      where: { id: input.agentRunId },
      data: { sandboxId: sandbox.sandboxId, sandboxStatus: "RUNNING" },
    });
    await log("sandbox_started", `Sandbox ready (${sandbox.sandboxId}).`);

    // 2. Clone the repo.
    let workdir = "/home/user/repo";
    let repoReady = false;
    if (project?.cloneUrl) {
      await log("cloning_repo", `Cloning ${project.fullName} (${project.defaultBranch})...`);
      const { dir, result } = await cloneRepo(sandbox, {
        cloneUrl: project.cloneUrl,
        branch: project.defaultBranch,
        token: project.account?.accessToken ?? undefined,
      });
      workdir = dir;
      if (result.exitCode === 0) {
        repoReady = true;
        await log("repo_cloned", "Repository cloned. Inspecting the code...");
      } else {
        await log("clone_failed", `Could not clone the repo: ${result.stderr.slice(0, 200)}. Planning from the scan only.`, { level: "WARN" });
      }
    }

    // 3 + 4. Inspect the repo and build the plan.
    let planned: PlannedCheck[];
    let summary: string;

    if (repoReady && hasAiKey()) {
      const tools = sandboxTools(sandbox, { workdir }).filter((t) =>
        ["list_dir", "read_file", "run_command"].includes(t.name),
      ) as AgentTool[];

      const onEvent = async (e: AgentStepLog) => {
        if (e.type === "assistant" && e.content?.trim()) {
          // Skip the final JSON blob; only narrate human sentences. Also strip a
          // trailing ```json plan fence the model sometimes appends to prose
          // (the plan card already shows that), so the chat stays readable.
          const cleaned = e.content
            .replace(/```(?:json)?\s*[\s\S]*?```/g, "")
            .trim();
          if (cleaned && !cleaned.startsWith("{")) await log("agent_message", cleaned);
        } else if (e.type === "tool_call") {
          const a = e.toolArgs ?? {};
          const msg =
            e.toolName === "run_command"
              ? `$ ${String(a.command ?? "")}`
              : e.toolName === "read_file"
                ? `Reading ${String(a.path ?? "")}`
                : e.toolName === "list_dir"
                  ? `Listing ${String(a.path ?? ".")}`
                  : `${e.toolName}(${JSON.stringify(a)})`;
          await log("tool_call", msg);
        }
      };

      const res = await runAgent({
        system: PLANNER_AGENT_SYSTEM,
        user: buildUserMessage(input.checks, input.websiteUrl, project?.fullName ?? ""),
        tools,
        maxSteps: 26,
        forceFinalAfterSteps: 20,
        finalInstruction: "Stop inspecting and return ONLY the final JSON plan object now.",
        temperature: 0,
        onEvent,
      });

      const parsed = parsePlanJson(res.finalText);
      if (!parsed) throw new Error("Planner did not return a valid plan.");
      planned = mapParsedToPlanned(parsed, input.checks);
      summary = parsed.summary?.trim() || "Here's the plan to take each failing check to a full pass.";

      await prisma.agentRun
        .update({
          where: { id: input.agentRunId },
          data: { model: DEFAULT_MODEL, tokensIn: res.tokensIn, tokensOut: res.tokensOut },
        })
        .catch(() => {});
    } else {
      // Fallback: no repo / no AI key -> deterministic plan from the scan.
      if (!repoReady) await log("agent_message", "Planning each fix from the scan findings.");
      planned = input.checks.map(planCheck);
      summary = "Here's the plan to take each failing check to a full pass, based on the scan findings.";
    }

    // 5. Persist the plan + the final plan message.
    return await persistPlan({
      agentRunId: input.agentRunId,
      agentPlanId: input.agentPlanId,
      projectId: input.projectId,
      userId: input.userId,
      summary,
      planned,
      log,
    });
  } catch (err) {
    await failPlan({ ...ref, agentPlanId: input.agentPlanId }, err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    // 6. Kill the sandbox and clear its id from the run (silent — keeps the
    // plan as the last chat message).
    if (sandbox) await killSandbox(sandbox);
    await prisma.agentRun
      .update({ where: { id: input.agentRunId }, data: { sandboxId: null, sandboxStatus: "KILLED" } })
      .catch(() => {});
  }
}
