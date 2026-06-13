import { z } from "zod";

export const FeatureInterestKeySchema = z.enum(["AI_VISIBILITY"]);
export type FeatureInterestKey = z.infer<typeof FeatureInterestKeySchema>;

export interface FeatureInterestState {
  feature: FeatureInterestKey;
  interested: boolean;
  projectId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface FeatureInterestResponse {
  interest: FeatureInterestState;
}
