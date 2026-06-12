// Input the API passes when starting a fix run. The AgentRun + AgentPlan (with
// the user's answers) already exist; the workflow reads the checks to fix from
// the DB inside the setup activity.
import type { AgentPlanAnswer } from "@repo/types/agent";

export const SUBMIT_FIX_DECISIONS_SIGNAL = "submitFixDecisions";

export interface AgentFixWorkflowInput {
  agentRunId: string;
  agentPlanId: string;
  projectId: string;
  userId: string;
}

export interface AgentFixDecisionSignal {
  answers: AgentPlanAnswer[];
  submittedAt: string;
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

// A batch of related checks fixed in ONE agent session (they touch the same
// surface — e.g. the shared <head>/layout, the crawl files, or the page body).
// Batching collapses N per-check sessions into a handful, so the agent reads
// the shared files once instead of re-exploring the repo per check.
export interface FixGroup {
  id: string;
  label: string;
  // Model id for this group (cheap for mechanical groups, default otherwise).
  model: string;
  checks: FixCheckInput[];
}

export interface FixSetup {
  sandboxId: string;
  workdir: string;
  // Batched groups (preferred). `checks` kept for back-compat / flat access.
  groups: FixGroup[];
  checks: FixCheckInput[];
  // The planner's summary of the stack, reused as fix-agent context so it does
  // not re-discover the framework/layout/content sources.
  repoSummary: string;
}

export interface RevalidateSetup {
  sandboxId: string;
  workdir: string;
}
