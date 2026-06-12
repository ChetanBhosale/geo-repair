import { prisma } from "@repo/db";
import type {
  FeatureInterestKey,
  FeatureInterestState,
} from "@repo/types/feature-interest";

const AI_VISIBILITY: FeatureInterestKey = "AI_VISIBILITY";

type FeatureInterestRow = {
  feature: FeatureInterestKey;
  createdAt: Date;
  updatedAt: Date;
};

function toState(row: FeatureInterestRow | null): FeatureInterestState {
  return {
    feature: AI_VISIBILITY,
    interested: !!row,
    createdAt: row?.createdAt.toISOString() ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

export async function getAiVisibilityInterest(
  userId: string,
): Promise<FeatureInterestState> {
  const row = await prisma.featureInterest.findUnique({
    where: { userId_feature: { userId, feature: AI_VISIBILITY } },
  });
  return toState(row);
}

export async function markAiVisibilityInterest(
  userId: string,
): Promise<FeatureInterestState> {
  const row = await prisma.featureInterest.upsert({
    where: { userId_feature: { userId, feature: AI_VISIBILITY } },
    update: { updatedAt: new Date() },
    create: { userId, feature: AI_VISIBILITY },
  });
  return toState(row);
}
