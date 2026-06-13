import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import {
  AI_CREDIT_INPUT_TOKEN_WEIGHT,
  AI_CREDIT_OUTPUT_TOKEN_WEIGHT,
  aiCreditLimitForTier,
  aiCreditsForUsage,
  aiCreditsLeft,
  legacyChatMessagesLeftForCredits,
} from "@repo/types/entitlements";

type AiCreditTier = "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE_CUSTOM";

export type AiCreditOrderSnapshot = {
  tier: AiCreditTier;
  aiCreditsIncluded: number;
  aiCreditsUsed: number;
};

export function aiCreditSnapshot(order: AiCreditOrderSnapshot) {
  const included =
    order.aiCreditsIncluded > 0
      ? order.aiCreditsIncluded
      : aiCreditLimitForTier(order.tier);
  const used = Math.max(0, order.aiCreditsUsed);
  return {
    aiCreditsIncluded: included,
    aiCreditsUsed: used,
    aiCreditsLeft: aiCreditsLeft({
      aiCreditsIncluded: included,
      aiCreditsUsed: used,
    }),
    chatMessagesLeft: legacyChatMessagesLeftForCredits({
      aiCreditsIncluded: included,
      aiCreditsUsed: used,
    }),
  };
}

export async function recordFollowUpAiUsage(input: {
  orderId: string;
  agentRunId: string;
  workflowId: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  reason: "chat" | "revalidate";
}) {
  const inputTokens = Math.max(0, Math.floor(input.inputTokens));
  const outputTokens = Math.max(0, Math.floor(input.outputTokens));
  const inputCredits = inputTokens * AI_CREDIT_INPUT_TOKEN_WEIGHT;
  const outputCredits = outputTokens * AI_CREDIT_OUTPUT_TOKEN_WEIGHT;
  const totalCredits = aiCreditsForUsage(inputTokens, outputTokens);

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: input.orderId },
      data: {
        aiCreditsUsed: { increment: totalCredits },
      },
      select: {
        tier: true,
        aiCreditsIncluded: true,
        aiCreditsUsed: true,
      },
    });

    await tx.agentRun.update({
      where: { id: input.agentRunId },
      data: {
        tokensIn: { increment: inputTokens },
        tokensOut: { increment: outputTokens },
        model: input.model,
        chatMessagesLeft: legacyChatMessagesLeftForCredits(order),
      },
    });

    await tx.aiUsageEvent.create({
      data: {
        orderId: input.orderId,
        agentRunId: input.agentRunId,
        workflowId: input.workflowId,
        model: input.model,
        reason: input.reason,
        inputTokens,
        outputTokens,
        inputCredits,
        outputCredits,
        totalCredits,
      } satisfies Prisma.AiUsageEventUncheckedCreateInput,
    });

    return aiCreditSnapshot(order);
  });
}
