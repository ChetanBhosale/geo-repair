import { prisma } from "@repo/db";
import type { ChatResponse } from "@repo/types/agent";
import { getTemporalClient } from "../temporal/client";
import { TASK_QUEUES } from "../temporal/constants";
import { getPrStatus } from "../lib/github";
import type { AgentChatWorkflowInput } from "../temporal/worker/agent-chat/workflow-types";

export class ChatError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ChatError";
  }
}

// Send a chat message to the fix agent. Guards: the run must have an open PR,
// the PR must not be merged (re-checked live on GitHub), and there must be chat
// budget left. Persists the user message, decrements the budget, and enqueues
// one chat turn.
export async function startChat(
  userId: string,
  agentRunId: string,
  message: string,
): Promise<ChatResponse> {
  const text = (message ?? "").trim();
  if (!text) throw new ChatError(400, "Message cannot be empty.");

  const run = await prisma.agentRun.findFirst({
    where: { id: agentRunId, userId },
    include: { project: { include: { account: { select: { accessToken: true } } } } },
  });
  if (!run) throw new ChatError(404, "Agent run not found.");
  if (!run.prUrl || !run.prNumber) {
    throw new ChatError(409, "Chat opens once the fix PR is created.");
  }
  if (run.status === "CHATTING") {
    throw new ChatError(409, "The agent is still working on your last message.");
  }

  // Live merge check — if merged, close chat for good.
  if (run.project) {
    const pr = await getPrStatus(run.project.owner, run.project.name, run.prNumber, run.project.account?.accessToken);
    if (pr?.merged && !run.prMerged) {
      await prisma.agentRun.update({
        where: { id: run.id },
        data: { prMerged: true, prState: "MERGED", prMergedAt: new Date() },
      });
    }
    if (pr?.merged || run.prMerged) {
      throw new ChatError(409, "The PR has been merged. This run is complete.");
    }
  }
  if (run.prMerged) throw new ChatError(409, "The PR has been merged. This run is complete.");
  if (run.chatMessagesLeft <= 0) {
    throw new ChatError(409, "You've used all your chat messages for this run.");
  }

  // Persist the user's message and spend one from the budget.
  await prisma.log.create({
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
  const updated = await prisma.agentRun.update({
    where: { id: run.id },
    data: { chatMessagesLeft: { decrement: 1 }, status: "CHATTING" },
    select: { chatMessagesLeft: true },
  });

  const workflowId = `agent-chat-${run.id}-${Date.now()}`;
  try {
    const client = await getTemporalClient();
    const input: AgentChatWorkflowInput = {
      agentRunId: run.id,
      projectId: run.projectId,
      userId,
      message: text,
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
      data: { status: "PR_OPENED", chatMessagesLeft: { increment: 1 } },
    });
    throw new ChatError(502, `Could not start the chat: ${m}`);
  }

  return { agentRunId: run.id, status: "CHATTING", chatMessagesLeft: updated.chatMessagesLeft };
}
