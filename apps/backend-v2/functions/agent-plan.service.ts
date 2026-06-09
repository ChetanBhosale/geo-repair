import { prisma } from "@repo/db";
import type {
  AgentChatLog,
  AgentPlanCheckDTO,
  AgentPlanDTO,
  AgentRunDetail,
  AgentRunSummary,
  StartAgentPlanResponse,
} from "@repo/types/agent";
import { getTemporalClient } from "../temporal/client";
import { TASK_QUEUES } from "../temporal/constants";
// import { checkWorkerRunning } from "../lib/worker-health";
import type { PlanCheckInput } from "../temporal/worker/agent-plan/types";
import type { AgentPlanWorkflowInput } from "../temporal/worker/agent-plan/workflow-types";

export class AgentPlanError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AgentPlanError";
  }
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
): Promise<StartAgentPlanResponse> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new AgentPlanError(404, "Project not found.");

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
    throw new AgentPlanError(400, "No completed scan to plan from. Run a scan first.");
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
      projectId: project.id,
      userId,
      scrapingId: scraping.id,
      status: "PLANNING",
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
    throw new AgentPlanError(502, `Could not queue the plan: ${message}`);
  }

  return {
    agentRunId: run.id,
    agentPlanId: plan.id,
    status: run.status,
    plannedChecks: checks.length,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

function toRunSummary(row: {
  id: string;
  projectId: string;
  status: string;
  scrapingId: string | null;
  scoreBefore: number | null;
  scoreAfter: number | null;
  sandboxStatus: string;
  prState: string;
  prUrl: string | null;
  error: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}): AgentRunSummary {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status as AgentRunSummary["status"],
    scrapingId: row.scrapingId,
    scoreBefore: row.scoreBefore,
    scoreAfter: row.scoreAfter,
    sandboxStatus: row.sandboxStatus as AgentRunSummary["sandboxStatus"],
    prState: row.prState as AgentRunSummary["prState"],
    prUrl: row.prUrl,
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
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map(toRunSummary);
}

// One run with its plan (+ checks) and chat logs, for the agent screen.
export async function getAgentRunDetail(
  userId: string,
  agentRunId: string,
): Promise<AgentRunDetail | null> {
  const row = await prisma.agentRun.findFirst({
    where: { id: agentRunId, userId },
    include: {
      plan: { include: { checks: { orderBy: { seq: "asc" } } } },
      logs: { orderBy: [{ createdAt: "asc" }, { seq: "asc" }], take: 500 },
    },
  });
  if (!row) return null;

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

  const logs: AgentChatLog[] = row.logs.map((l) => ({
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
