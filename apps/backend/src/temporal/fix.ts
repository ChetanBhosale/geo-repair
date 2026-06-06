import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import type { FixRunIntake } from "@repo/types/fix";
import { getPaidFixOrderForUser } from "../billing/billing.service";
import { EntitlementError, FIX_ATTEMPT_LIMIT } from "../billing/entitlements";
import { normalizeWebsite } from "../lib/url";
import { getTemporalClient } from "./client";
import { TASK_QUEUES } from "./shared";
import { fixSiteWorkflow } from "./functions/fix-site/workflows";

// Start a fix run for the authed user's selected repo against a website.
// Creates the FixRun row first (so the dashboard can poll immediately), then
// starts the Temporal workflow.
//
// A paid order grants up to FIX_ATTEMPT_LIMIT run attempts. The dedup + cap
// check + counter increment run inside one transaction that locks the order row
// (SELECT ... FOR UPDATE), so two concurrent POSTs for the same order can't both
// create a run or both slip past the cap.
export async function startFix(params: {
  userId: string;
  website: string;
  repositoryId: string;
  orderId: string;
  intake?: FixRunIntake;
}): Promise<{ fixRunId: string; temporalWorkflowId: string }> {
  const repo = await prisma.repository.findFirst({
    where: { id: params.repositoryId, userId: params.userId },
  });
  if (!repo) {
    throw new Error("Repository not found for this user");
  }

  const order = await getPaidFixOrderForUser({
    orderId: params.orderId,
    userId: params.userId,
  });
  if (!order) {
    throw new Error("A paid order is required before starting a fix");
  }
  if (order.repoFullName !== repo.fullName) {
    throw new Error("Paid order does not match the selected repository");
  }
  if (normalizeWebsite(order.website) !== params.website) {
    throw new Error("Paid order does not match the requested website");
  }

  const workflowId = `fix-${repo.fullName.replace(/[^a-zA-Z0-9-]/g, "_")}-${Date.now()}`;

  const outcome = await prisma.$transaction(async (tx) => {
    // Serialize concurrent starts for this order.
    await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${order.id} FOR UPDATE`;

    // Re-entry (double submit, page reload): an active or already-succeeded run
    // for this order is returned as-is and does NOT consume a new attempt. Only
    // a FAILED last run leaves the order open for a fresh attempt.
    const latest = await tx.fixRun.findFirst({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, temporalWorkflowId: true, state: true },
    });
    if (latest && latest.state !== "FAILED") {
      return {
        reused: true as const,
        fixRunId: latest.id,
        temporalWorkflowId: latest.temporalWorkflowId,
      };
    }

    const locked = await tx.order.findUnique({
      where: { id: order.id },
      select: { fixAttemptsUsed: true },
    });
    const used = locked?.fixAttemptsUsed ?? 0;
    if (used >= FIX_ATTEMPT_LIMIT) {
      throw new EntitlementError(
        402,
        `This order has used all ${FIX_ATTEMPT_LIMIT} fix attempts. Use the run chat to request more changes, or contact support.`,
      );
    }

    const run = await tx.fixRun.create({
      data: {
        userId: params.userId,
        repositoryId: repo.id,
        orderId: order.id,
        website: params.website,
        intake: params.intake
          ? (params.intake as unknown as Prisma.InputJsonValue)
          : undefined,
        temporalWorkflowId: workflowId,
        state: "QUEUED",
        sandboxStatus: "NONE",
      },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { fixAttemptsUsed: { increment: 1 } },
    });

    if (params.intake) {
      await tx.runEvent.create({
        data: {
          fixRunId: run.id,
          seq: 1,
          type: "intake_submitted",
          phase: "QUEUED",
          payload: params.intake as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return {
      reused: false as const,
      fixRunId: run.id,
      temporalWorkflowId: workflowId,
    };
  });

  if (outcome.reused) {
    return {
      fixRunId: outcome.fixRunId,
      temporalWorkflowId: outcome.temporalWorkflowId,
    };
  }

  // Start the workflow after the transaction commits. If the start fails, fail
  // the run and refund the consumed attempt so an infra error never burns the
  // user's allowance.
  try {
    const client = await getTemporalClient();
    const handle = await client.workflow.start(fixSiteWorkflow, {
      taskQueue: TASK_QUEUES.fixSite,
      workflowId,
      args: [
        {
          fixRunId: outcome.fixRunId,
          website: params.website,
          repoFullName: repo.fullName,
          cloneUrl: repo.cloneUrl,
          defaultBranch: repo.defaultBranch,
          userId: params.userId,
          intake: params.intake,
        },
      ],
      workflowExecutionTimeout: "1 hour",
    });

    await prisma.fixRun.update({
      where: { id: outcome.fixRunId },
      data: { temporalRunId: handle.firstExecutionRunId },
    });
  } catch (err) {
    await prisma.fixRun.update({
      where: { id: outcome.fixRunId },
      data: {
        state: "FAILED",
        error: err instanceof Error ? err.message : "Failed to start fix run",
      },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { fixAttemptsUsed: { decrement: 1 } },
    });
    throw err;
  }

  return { fixRunId: outcome.fixRunId, temporalWorkflowId: workflowId };
}
