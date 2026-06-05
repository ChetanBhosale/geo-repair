import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import type { FixRunIntake } from "@repo/types/fix";
import { getPaidFixOrderForUser } from "../billing/billing.service";
import { normalizeWebsite } from "../lib/url";
import { getTemporalClient } from "./client";
import { TASK_QUEUES } from "./shared";
import { fixSiteWorkflow } from "./functions/fix-site/workflows";

// Start a fix run for the authed user's selected repo against a website.
// Creates the FixRun row first (so the dashboard can poll immediately), then
// starts the Temporal workflow.
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

  const existingRun = await prisma.fixRun.findFirst({
    where: {
      userId: params.userId,
      repositoryId: repo.id,
      website: params.website,
      state: { not: "FAILED" },
      createdAt: { gte: order.paidAt ?? order.updatedAt },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      temporalWorkflowId: true,
    },
  });
  if (existingRun) {
    return {
      fixRunId: existingRun.id,
      temporalWorkflowId: existingRun.temporalWorkflowId,
    };
  }

  const workflowId = `fix-${repo.fullName.replace(/[^a-zA-Z0-9-]/g, "_")}-${Date.now()}`;

  const run = await prisma.fixRun.create({
    data: {
      userId: params.userId,
      repositoryId: repo.id,
      website: params.website,
      intake: params.intake
        ? (params.intake as unknown as Prisma.InputJsonValue)
        : undefined,
      temporalWorkflowId: workflowId,
      state: "QUEUED",
      sandboxStatus: "NONE",
    },
  });

  if (params.intake) {
    await prisma.runEvent.create({
      data: {
        fixRunId: run.id,
        seq: 1,
        type: "intake_submitted",
        phase: "QUEUED",
        payload: params.intake as unknown as Prisma.InputJsonValue,
      },
    });
  }

  const client = await getTemporalClient();
  const handle = await client.workflow.start(fixSiteWorkflow, {
    taskQueue: TASK_QUEUES.fixSite,
    workflowId,
    args: [
      {
        fixRunId: run.id,
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
    where: { id: run.id },
    data: { temporalRunId: handle.firstExecutionRunId },
  });

  return { fixRunId: run.id, temporalWorkflowId: workflowId };
}
