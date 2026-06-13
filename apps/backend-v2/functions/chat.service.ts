import { prisma } from "@repo/db";
import type { ChatResponse } from "@repo/types/agent";
import { getTemporalClient } from "../temporal/client";
import { TASK_QUEUES } from "../temporal/constants";
import { getPrStatus } from "../lib/github";
import type { AgentChatWorkflowInput } from "../temporal/worker/agent-chat/workflow-types";
import { aiCreditSnapshot } from "./ai-credits";

export class ChatError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ChatError";
  }
}

// Send a chat message to the fix agent. Guards: the run must have produced a PR
// at least once, must not be failed/canceled, and must have order-level chat
// budget left. A merged or closed PR becomes a follow-up PR target in the worker.
export async function startChat(
  userId: string,
  agentRunId: string,
  message: string,
): Promise<ChatResponse> {
  const text = (message ?? "").trim();
  if (!text) throw new ChatError(400, "Message cannot be empty.");

  const run = await prisma.agentRun.findFirst({
    where: { id: agentRunId, userId },
    include: {
      order: true,
      project: { include: { account: { select: { accessToken: true } } } },
    },
  });
  if (!run) throw new ChatError(404, "Agent run not found.");
  if (!run.order || run.order.status !== "PAID") {
    throw new ChatError(402, "A paid AI Search Fix order is required.");
  }
  if (!run.prUrl || !run.prNumber) {
    throw new ChatError(409, "Chat opens once the fix PR is created.");
  }
  if (run.status === "CHATTING") {
    throw new ChatError(
      409,
      "The agent is still working on your last message.",
    );
  }

  // Live PR check. This records the current GitHub state, but never closes chat.
  if (run.project) {
    const pr = await getPrStatus(
      run.project.owner,
      run.project.name,
      run.prNumber,
      run.project.account?.accessToken,
    );
    if (pr?.merged) {
      await prisma.agentRun.update({
        where: { id: run.id },
        data: { prMerged: true, prState: "MERGED", prMergedAt: new Date() },
      });
    } else if (pr?.state === "open" || pr?.state === "closed") {
      const prState = pr.state === "closed" ? "CLOSED" : "OPEN";
      if (run.prMerged || run.prState !== prState) {
        await prisma.agentRun.update({
          where: { id: run.id },
          data: { prMerged: false, prState, prMergedAt: null },
        });
      }
    }
  }
  if (["CANCELED", "FAILED"].includes(run.status)) {
    throw new ChatError(
      409,
      "This run cannot accept more messages. Contact support or start from a new paid order.",
    );
  }
  const credits = aiCreditSnapshot(run.order);
  if (credits.aiCreditsLeft <= 0) {
    throw new ChatError(
      409,
      "You've used all your follow-up AI credits for this agent.",
    );
  }
  const workflowId = `agent-chat-${run.id}-${Date.now()}`;

  // Persist the user's message. Credits are spent by the worker after model
  // usage is known, so queue failures spend nothing.
  await prisma.$transaction(async (tx) => {
    const updatedRun = await tx.agentRun.updateMany({
      where: { id: run.id, status: { not: "CHATTING" } },
      data: {
        error: null,
        status: "CHATTING",
        temporalWorkflowId: workflowId,
      },
    });
    if (updatedRun.count === 0) {
      throw new ChatError(
        409,
        "The agent is still working on your last message.",
      );
    }

    await tx.log.create({
      data: {
        source: "USER",
        level: "INFO",
        event: "user_message",
        message: text,
        agentRunId: run.id,
        projectId: run.projectId,
        userId,
      },
    });
  });

  try {
    const client = await getTemporalClient();
    const input: AgentChatWorkflowInput = {
      agentRunId: run.id,
      projectId: run.projectId,
      userId,
      message: text,
      kind: "USER",
    };
    await client.workflow.start("agentChatWorkflow", {
      taskQueue: TASK_QUEUES.agentChat,
      workflowId,
      args: [input],
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    // Roll back to a usable state.
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: "PR_OPENED",
        chatMessagesLeft: credits.chatMessagesLeft,
        temporalWorkflowId: run.temporalWorkflowId,
      },
    });
    throw new ChatError(502, `Could not start the chat: ${m}`);
  }

  return {
    agentRunId: run.id,
    status: "CHATTING",
    aiCreditsLeft: credits.aiCreditsLeft,
    chatMessagesLeft: credits.chatMessagesLeft,
  };
}
