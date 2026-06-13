import { prisma } from "@repo/db";
import type {
  AgentChatLog,
  AgentPlanCheckDTO,
  AgentPlanDTO,
  AgentRunDetail,
  AgentRunSummary,
  StartAgentPlanResponse,
} from "@repo/types/agent";
import { numberedSlug, uniqueSlug } from "@repo/types/slugs";
import { getTemporalClient } from "../temporal/client";
import { TASK_QUEUES } from "../temporal/constants";
// import { checkWorkerRunning } from "../lib/worker-health";
import { FIX_ATTEMPT_LIMIT } from "@repo/types/entitlements";
import type { PlanCheckInput } from "../temporal/worker/agent-plan/types";
import type { AgentPlanWorkflowInput } from "../temporal/worker/agent-plan/workflow-types";
import { getPaidOrderForAgentPlan } from "./billing.service";
import { sendFixFailedEmail } from "../lib/email-notifications";
import { aiCreditSnapshot } from "./ai-credits";

const AGENT_DETAIL_LOG_LIMIT = 500;

export class AgentPlanError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AgentPlanError";
  }
}

async function nextAgentRunSlug(projectId: string): Promise<string> {
  const rows = await prisma.agentRun.findMany({
    where: { projectId },
    select: { slug: true },
  });
  return uniqueSlug(
    numberedSlug("fix", rows.length),
    rows.map((row) => row.slug),
  );
}

// The shape we read out of Scraping.result (the scraper's SiteCheck). Only the
// fields the planner needs.
interface StoredSiteCheck {
  name: string;
  category: string;
  tier: string;
  scope?: string;
  weight: number;
  status: string;
  fixableByAgent?: boolean | "partial";
  recommendedAction?: string;
  summary?: string;
  evidence?: string | null;
  recommendation?: string | null;
  affectedPages?: {
    page: string;
    status: string;
    issue: string;
    recommendation: string | null;
  }[];
}

interface StoredScanResult {
  rubricVersion?: string;
  score?: { overall?: number };
  checks?: StoredSiteCheck[];
}

function fixabilityToString(v: boolean | "partial" | undefined): string {
  if (v === "partial") return "partial";
  return v ? "true" : "false";
}

// Checks worth planning: the ones the scan did not pass. SUCCESS / NOT_APPLICABLE
// / INCONCLUSIVE are skipped (nothing to fix or nothing we can act on).
function toPlanInputs(checks: StoredSiteCheck[]): PlanCheckInput[] {
  return checks
    .filter((c) => c.status === "FAILED" || c.status === "MID")
    .map((c) => ({
      rubricId: c.name,
      category: c.category,
      tier: c.tier,
      weight: c.weight,
      scanStatus: c.status,
      fixableByAgent: fixabilityToString(c.fixableByAgent),
      scope: c.scope ?? "per-page",
      recommendedAction: c.recommendedAction ?? "flag_only",
      summary: c.summary ?? "",
      evidence: c.evidence ?? null,
      recommendation: c.recommendation ?? null,
      affectedPages: c.affectedPages ?? [],
    }));
}

// Start a planning run for a project: take its LATEST completed scan, create the
// AgentRun + AgentPlan (DRAFTING) + WorkerStatus, then enqueue the agent-plan
// workflow. The worker plans each check (one activity each) and writes the
// single plan-card log. Returns the created run + plan ids so the UI can poll.
export async function startAgentPlan(
  userId: string,
  projectId: string,
  orderId: string,
): Promise<StartAgentPlanResponse> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new AgentPlanError(404, "Project not found.");

  const order = await getPaidOrderForAgentPlan({
    orderId,
    userId,
    projectId,
    allowUsedAttempt: true,
  });

  const existingRun = await prisma.agentRun.findFirst({
    where: {
      projectId,
      userId,
      status: { notIn: ["FAILED", "CANCELED"] },
    },
    include: { plan: { include: { checks: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (existingRun?.plan) {
    return {
      agentRunId: existingRun.id,
      agentRunSlug: existingRun.slug,
      agentPlanId: existingRun.plan.id,
      status: existingRun.status as StartAgentPlanResponse["status"],
      plannedChecks: existingRun.plan.checks.length,
    };
  }

  if (order.fixAttemptsUsed >= FIX_ATTEMPT_LIMIT) {
    throw new AgentPlanError(
      409,
      "This paid order already has an agent. Resume the existing thread.",
    );
  }

  // Only one live agent thread per project. PR merge/close does not close the
  // thread; the user can keep spending the same order-level chat budget.
  const openRun = await prisma.agentRun.findFirst({
    where: {
      projectId,
      userId,
      status: { notIn: ["FAILED", "CANCELED"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (openRun) {
    throw new AgentPlanError(
      409,
      "There is already an active agent thread for this project.",
    );
  }

  // NOTE: worker-liveness gate disabled - describeTaskQueue check was not
  // behaving as expected. Re-enable once fixed.
  // if (!(await checkWorkerRunning(TASK_QUEUES.agentPlan))) {
  //   throw new AgentPlanError(
  //     503,
  //     "The agent worker is offline right now. Please try again shortly.",
  //   );
  // }

  const scraping = await prisma.scraping.findFirst({
    where: { projectId, userId, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
  });
  if (!scraping || !scraping.result) {
    throw new AgentPlanError(
      400,
      "No completed scan to plan from. Run a scan first.",
    );
  }

  const result = scraping.result as unknown as StoredScanResult;
  const checks = toPlanInputs(result.checks ?? []);
  if (checks.length === 0) {
    throw new AgentPlanError(
      400,
      "The latest scan has no failing checks to fix. The site already passes.",
    );
  }

  const run = await prisma.agentRun.create({
    data: {
      slug: await nextAgentRunSlug(project.id),
      projectId: project.id,
      userId,
      scrapingId: scraping.id,
      orderId: order.id,
      status: "PLANNING",
      chatMessagesLeft: aiCreditSnapshot(order).chatMessagesLeft,
      scoreBefore: scraping.score,
      rubricVersion: result.rubricVersion ?? null,
      startedAt: new Date(),
      plan: {
        create: {
          status: "DRAFTING",
          scoreBefore: scraping.score,
          rubricVersion: result.rubricVersion ?? null,
        },
      },
    },
    include: { plan: true },
  });

  const plan = run.plan!;
  const workflowId = `agent-plan-${run.id}`;

  await prisma.workerStatus.create({
    data: {
      service: "AGENT",
      status: "RUNNING",
      userId,
      projectId: project.id,
      temporalWorkflowId: workflowId,
      title: `Plan fixes for ${project.websiteUrl}`,
      startedAt: new Date(),
    },
  });

  try {
    const client = await getTemporalClient();
    const input: AgentPlanWorkflowInput = {
      agentRunId: run.id,
      agentPlanId: plan.id,
      projectId: project.id,
      userId,
      scrapingId: scraping.id,
      websiteUrl: project.websiteUrl,
      scoreBefore: scraping.score,
      rubricVersion: result.rubricVersion ?? null,
      checks,
    };
    await client.workflow.start("agentPlanWorkflow", {
      taskQueue: TASK_QUEUES.agentPlan,
      workflowId,
      args: [input],
    });

    await prisma.agentRun.update({
      where: { id: run.id },
      data: { temporalWorkflowId: workflowId },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    await prisma.agentPlan.update({
      where: { id: plan.id },
      data: { status: "FAILED" },
    });
    await prisma.workerStatus.updateMany({
      where: { temporalWorkflowId: workflowId },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    await prisma.log.create({
      data: {
        source: "AGENT",
        level: "ERROR",
        event: "plan_enqueue_failed",
        message,
        agentRunId: run.id,
        agentPlanId: plan.id,
        projectId: project.id,
        userId,
      },
    });
    await sendFixFailedEmail(run.id, message).catch((sendErr) => {
      console.error(
        "[email] plan enqueue failure notification failed:",
        sendErr,
      );
    });
    throw new AgentPlanError(502, `Could not queue the plan: ${message}`);
  }

  return {
    agentRunId: run.id,
    agentRunSlug: run.slug,
    agentPlanId: plan.id,
    status: run.status,
    plannedChecks: checks.length,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

// A run is "open" while the paid agent thread can still be viewed or messaged.
// PR merge/close is routing context for the next chat turn, not a close signal.
const TERMINAL_RUN_STATUS = new Set(["FAILED", "CANCELED"]);
export function isRunOpen(row: {
  status: string;
  prState: string;
  prUrl?: string | null;
  prMerged?: boolean;
}): boolean {
  if (row.status === "COMPLETED" && !row.prUrl) return false;
  return !TERMINAL_RUN_STATUS.has(row.status);
}

async function syncAgentRunFromTemporal(row: {
  id: string;
  userId: string;
  projectId: string;
  status: string;
  prState: string;
  temporalWorkflowId: string | null;
}): Promise<void> {
  if (!isRunOpen(row) || !row.temporalWorkflowId) return;

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(row.temporalWorkflowId);
    const desc = await handle.describe();

    if (
      desc.status.name !== "FAILED" &&
      desc.status.name !== "TERMINATED" &&
      desc.status.name !== "TIMED_OUT" &&
      desc.status.name !== "CANCELLED"
    ) {
      return;
    }

    const canceled = desc.status.name === "CANCELLED";
    const status = canceled ? "CANCELED" : "FAILED";
    const message = `Workflow ${desc.status.name.toLowerCase()}.`;

    await prisma.agentRun.update({
      where: { id: row.id },
      data: { status, error: message, finishedAt: new Date() },
    });
    await prisma.agentPlan.updateMany({
      where: { agentRunId: row.id, status: "DRAFTING" },
      data: { status: "FAILED" },
    });
    await prisma.workerStatus.updateMany({
      where: { temporalWorkflowId: row.temporalWorkflowId },
      data: { status, error: message, finishedAt: new Date() },
    });
    await prisma.log.create({
      data: {
        source: "AGENT",
        level: "ERROR",
        event: "workflow_reconcile_failed",
        message,
        agentRunId: row.id,
        projectId: row.projectId,
        userId: row.userId,
      },
    });
    await sendFixFailedEmail(row.id, message).catch((sendErr) => {
      console.error(
        "[email] agent reconcile failure notification failed:",
        sendErr,
      );
    });
  } catch {
    // Temporal unreachable: leave the DB as-is.
  }
}

function toRunSummary(row: {
  id: string;
  slug: string;
  projectId: string;
  status: string;
  scrapingId: string | null;
  scoreBefore: number | null;
  scoreAfter: number | null;
  sandboxStatus: string;
  prState: string;
  prUrl: string | null;
  prMerged: boolean;
  branch: string | null;
  chatMessagesLeft: number;
  order?: {
    tier: "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE_CUSTOM";
    aiCreditsIncluded: number;
    aiCreditsUsed: number;
  } | null;
  orderId: string | null;
  error: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}): AgentRunSummary {
  const prMerged = row.prState === "MERGED";
  const credits = row.order
    ? aiCreditSnapshot(row.order)
    : {
        aiCreditsUsed: 0,
        aiCreditsIncluded: 0,
        aiCreditsLeft: 0,
        chatMessagesLeft: row.chatMessagesLeft,
      };

  return {
    id: row.id,
    slug: row.slug,
    projectId: row.projectId,
    status: row.status as AgentRunSummary["status"],
    scrapingId: row.scrapingId,
    scoreBefore: row.scoreBefore,
    scoreAfter: row.scoreAfter,
    sandboxStatus: row.sandboxStatus as AgentRunSummary["sandboxStatus"],
    prState: row.prState as AgentRunSummary["prState"],
    prUrl: row.prUrl,
    prMerged,
    branch: row.branch,
    aiCreditsUsed: credits.aiCreditsUsed,
    aiCreditsIncluded: credits.aiCreditsIncluded,
    aiCreditsLeft: credits.aiCreditsLeft,
    chatMessagesLeft: credits.chatMessagesLeft,
    orderId: row.orderId,
    isOpen: isRunOpen(row),
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

// All agent runs for a project, newest first.
export async function listAgentRuns(
  userId: string,
  projectId: string,
): Promise<AgentRunSummary[]> {
  const rows = await prisma.agentRun.findMany({
    where: { projectId, userId },
    include: {
      order: {
        select: { tier: true, aiCreditsIncluded: true, aiCreditsUsed: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const openRows = rows.filter(isRunOpen);
  if (openRows.length > 0) {
    await Promise.all(openRows.map((row) => syncAgentRunFromTemporal(row)));
    const freshRows = await prisma.agentRun.findMany({
      where: { projectId, userId },
      include: {
        order: {
          select: { tier: true, aiCreditsIncluded: true, aiCreditsUsed: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return freshRows.map(toRunSummary);
  }

  return rows.map(toRunSummary);
}

// One run with its plan (+ checks) and chat logs, for the agent screen.
export async function getAgentRunDetail(
  userId: string,
  agentRunId: string,
): Promise<AgentRunDetail | null> {
  const current = await prisma.agentRun.findFirst({
    where: { id: agentRunId, userId },
  });
  if (!current) return null;

  await syncAgentRunFromTemporal(current);

  const row = await prisma.agentRun.findFirst({
    where: { id: agentRunId, userId },
    include: {
      order: {
        select: { tier: true, aiCreditsIncluded: true, aiCreditsUsed: true },
      },
      plan: { include: { checks: { orderBy: { seq: "asc" } } } },
    },
  });
  if (!row) return null;

  const recentLogs = await prisma.log.findMany({
    where: { agentRunId },
    orderBy: [{ createdAt: "desc" }, { seq: "desc" }],
    take: AGENT_DETAIL_LOG_LIMIT,
  });
  const latestPlanLog = await prisma.log.findFirst({
    where: { agentRunId, agentPlanId: { not: null } },
    orderBy: [{ createdAt: "desc" }, { seq: "desc" }],
  });
  const logRowsById = new Map(recentLogs.map((log) => [log.id, log]));
  if (latestPlanLog) logRowsById.set(latestPlanLog.id, latestPlanLog);
  const orderedLogRows = [...logRowsById.values()].sort((a, b) => {
    const createdDelta = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdDelta !== 0) return createdDelta;
    const seqDelta = a.seq - b.seq;
    if (seqDelta !== 0) return seqDelta;
    return a.id.localeCompare(b.id);
  });

  const plan: AgentPlanDTO | null = row.plan
    ? {
        id: row.plan.id,
        status: row.plan.status as AgentPlanDTO["status"],
        summary: row.plan.summary,
        manual: (row.plan.manual as unknown as AgentPlanDTO["manual"]) ?? [],
        scoreBefore: row.plan.scoreBefore,
        rubricVersion: row.plan.rubricVersion,
        submittedAt: row.plan.submittedAt?.toISOString() ?? null,
        checks: row.plan.checks.map(
          (c): AgentPlanCheckDTO => ({
            id: c.id,
            rubricId: c.rubricId,
            category: c.category,
            tier: c.tier,
            weight: c.weight,
            scanStatus: c.scanStatus,
            fixableByAgent: c.fixableByAgent,
            evidence: c.evidence,
            recommendation: c.recommendation,
            mode: c.mode as AgentPlanCheckDTO["mode"],
            approach: c.approach,
            targetPages:
              (c.targetPages as unknown as AgentPlanCheckDTO["targetPages"]) ??
              [],
            question: c.question,
            options:
              (c.options as unknown as AgentPlanCheckDTO["options"]) ?? null,
            choice: c.choice as AgentPlanCheckDTO["choice"],
            selectedOption: c.selectedOption,
            userSuggestion: c.userSuggestion,
            outcome: c.outcome as AgentPlanCheckDTO["outcome"],
            reason: c.reason,
            seq: c.seq,
          }),
        ),
      }
    : null;

  const logs: AgentChatLog[] = orderedLogRows.map((l) => ({
    id: l.id,
    source: l.source as AgentChatLog["source"],
    level: l.level.toLowerCase() as AgentChatLog["level"],
    event: l.event,
    message: l.message ?? "",
    planId: l.agentPlanId,
    data: l.data ?? null,
    seq: l.seq,
    createdAt: l.createdAt.toISOString(),
  }));

  return { ...toRunSummary(row), plan, logs };
}

export async function getAgentRunDetailByProjectSlug(
  userId: string,
  projectId: string,
  slug: string,
): Promise<AgentRunDetail | null> {
  const row = await prisma.agentRun.findUnique({
    where: { projectId_slug: { projectId, slug } },
    select: { id: true, userId: true },
  });
  if (!row || row.userId !== userId) return null;
  return getAgentRunDetail(userId, row.id);
}
