import { prisma } from "@repo/db";
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
}): Promise<{ fixRunId: string; temporalWorkflowId: string }> {
  const repo = await prisma.repository.findFirst({
    where: { id: params.repositoryId, userId: params.userId },
  });
  if (!repo) {
    throw new Error("Repository not found for this user");
  }

  const workflowId = `fix-${repo.fullName.replace(/[^a-zA-Z0-9-]/g, "_")}-${Date.now()}`;

  const run = await prisma.fixRun.create({
    data: {
      userId: params.userId,
      repositoryId: repo.id,
      website: params.website,
      temporalWorkflowId: workflowId,
      state: "QUEUED",
      sandboxStatus: "NONE",
    },
  });

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
