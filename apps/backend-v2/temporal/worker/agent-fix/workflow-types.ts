// Input the API passes when starting a fix run. The AgentRun + AgentPlan (with
// the user's answers) already exist; the workflow reads the checks to fix from
// the DB inside the setup activity.
export interface AgentFixWorkflowInput {
  agentRunId: string;
  agentPlanId: string;
  projectId: string;
  userId: string;
}

// One check the fix run will act on (resolved from AgentPlanCheck inside setup).
export interface FixCheckInput {
  id: string;
  rubricId: string;
  category: string;
  approach: string | null;
  recommendation: string | null;
  evidence: string | null;
  targetPages: { url: string; action: string; reason: string }[];
  userSuggestion: string | null;
}

export interface FixSetup {
  sandboxId: string;
  workdir: string;
  checks: FixCheckInput[];
}
