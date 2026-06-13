import { prisma } from "@repo/db";
import type {
  FeatureInterestKey,
  FeatureInterestState,
} from "@repo/types/feature-interest";

const AI_VISIBILITY: FeatureInterestKey = "AI_VISIBILITY";

export class FeatureInterestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FeatureInterestError";
  }
}

type FeatureInterestRow = {
  feature: FeatureInterestKey;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toState(row: FeatureInterestRow | null): FeatureInterestState {
  return {
    feature: AI_VISIBILITY,
    interested: !!row,
    projectId: row?.projectId ?? null,
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
  projectId?: string | null,
): Promise<FeatureInterestState> {
  const normalizedProjectId = projectId?.trim() || null;
  if (normalizedProjectId) {
    const project = await prisma.project.findFirst({
      where: { id: normalizedProjectId, userId },
      select: { id: true },
    });
    if (!project) throw new FeatureInterestError(404, "Project not found.");
  }

  const row = await prisma.featureInterest.upsert({
    where: { userId_feature: { userId, feature: AI_VISIBILITY } },
    update: { projectId: normalizedProjectId, updatedAt: new Date() },
    create: { userId, projectId: normalizedProjectId, feature: AI_VISIBILITY },
  });
  return toState(row);
}
