// Shared shapes for the fix-agent run, its plan, the per-check plan items, and
// the chat (logs). The backend stores these across AgentRun / AgentPlan /
// AgentPlanCheck / Log; the dashboard renders them.

export type AgentRunStatus =
  | "QUEUED"
  | "PLANNING"
  | "AWAITING_INPUT"
  | "FIXING"
  | "VERIFYING"
  | "OPENING_PR"
  | "PR_OPENED"
  | "CHATTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED";

export type AgentPlanStatus =
  | "DRAFTING"
  | "AWAITING_USER"
  | "SUBMITTED"
  | "FAILED";

export type AgentPlanMode = "AUTO" | "NEEDS_INPUT";

export type AgentPlanChoice = "PENDING" | "APPROVED" | "DECLINED";

export type AgentPlanOutcome =
  | "PENDING"
  | "FIXED"
  | "SKIPPED_BY_USER"
  | "FLAGGED_MANUAL"
  | "ALREADY_OK"
  | "FAILED";

export type SandboxStatus =
  | "NONE"
  | "CREATING"
  | "RUNNING"
  | "STOPPED"
  | "KILLED";

export type PrState = "NONE" | "OPEN" | "MERGED" | "CLOSED";

export interface AgentTargetPage {
  url: string;
  action: "modify" | "create" | "delete";
  reason: string;
}

export interface AgentPlanOption {
  id: string;
  label: string;
  description?: string;
}

export interface AgentManualItem {
  rubricId: string;
  reason: string;
}

// One per-check plan row (AgentPlanCheck).
export interface AgentPlanCheckDTO {
  id: string;
  rubricId: string;
  category: string;
  tier: string;
  weight: number;
  scanStatus: string | null;
  fixableByAgent: string | null;
  evidence: string | null;
  recommendation: string | null;
  mode: AgentPlanMode;
  approach: string | null;
  targetPages: AgentTargetPage[];
  question: string | null;
  options: AgentPlanOption[] | null;
  choice: AgentPlanChoice;
  selectedOption: string | null;
  userSuggestion: string | null;
  outcome: AgentPlanOutcome;
  reason: string | null;
  seq: number;
}

// The single plan for a run (AgentPlan) + its checks.
export interface AgentPlanDTO {
  id: string;
  status: AgentPlanStatus;
  summary: string | null;
  manual: AgentManualItem[];
  scoreBefore: number | null;
  rubricVersion: string | null;
  submittedAt: string | null;
  checks: AgentPlanCheckDTO[];
}

// One chat/activity message (a Log row). When planId is set, this is the single
// plan-card message the user answers and submits. `source` is AGENT for chat
// messages and AGENT_FILE for code-change/build events (right-hand panel).
export interface AgentChatLog {
  id: string;
  source: "AGENT" | "AGENT_FILE" | "USER" | "SCRAPING" | "SYSTEM";
  level: "debug" | "info" | "warn" | "error";
  event: string;
  message: string;
  planId: string | null;
  data: unknown;
  seq: number;
  createdAt: string;
}

export interface AgentRunSummary {
  id: string;
  projectId: string;
  status: AgentRunStatus;
  scrapingId: string | null;
  scoreBefore: number | null;
  scoreAfter: number | null;
  sandboxStatus: SandboxStatus;
  prState: PrState;
  prUrl: string | null;
  prMerged: boolean;
  branch: string | null;
  chatMessagesLeft: number;
  orderId: string | null;
  // Convenience: the run is "open" (blocks a new run) until merged/terminal.
  isOpen: boolean;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface AgentRunDetail extends AgentRunSummary {
  plan: AgentPlanDTO | null;
  logs: AgentChatLog[];
}

export interface StartAgentPlanResponse {
  agentRunId: string;
  agentPlanId: string;
  status: AgentRunStatus;
  plannedChecks: number;
}

export interface StartAgentPlanRequest {
  orderId: string;
}

// One per-check answer the user submits with the plan.
export interface AgentPlanAnswer {
  rubricId: string;
  choice: AgentPlanChoice; // APPROVED | DECLINED (PENDING not allowed on submit)
  selectedOption?: string | null;
  userSuggestion?: string | null;
}

export interface SubmitPlanRequest {
  answers: AgentPlanAnswer[];
}

export interface StartFixResponse {
  agentRunId: string;
  status: AgentRunStatus;
  fixChecks: number;
}

export interface ChatRequest {
  agentRunId: string;
  message: string;
}

export interface ChatResponse {
  agentRunId: string;
  status: AgentRunStatus;
  chatMessagesLeft: number;
}

export interface RevalidateRunResponse {
  agentRunId: string;
  status: AgentRunStatus;
}

export interface CompleteRunResponse {
  agentRunId: string;
  prMerged: boolean;
}

export interface ListAgentRunsResponse {
  agentRuns: AgentRunSummary[];
}

export interface AgentRunDetailResponse {
  agentRun: AgentRunDetail;
}
