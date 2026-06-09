import type { PlanCheckInput } from "./types";

// Input the API passes when starting an agent-plan workflow. The service has
// already created the AgentRun + AgentPlan (DRAFTING) rows and pulled the
// failing checks out of the scan; the workflow plans each one and persists.
export interface AgentPlanWorkflowInput {
  agentRunId: string;
  agentPlanId: string;
  projectId: string;
  userId: string;
  scrapingId: string;
  websiteUrl: string;
  scoreBefore: number | null;
  rubricVersion: string | null;
  // The failing/MID checks to plan (one per check). SUCCESS checks are omitted.
  checks: PlanCheckInput[];
}
