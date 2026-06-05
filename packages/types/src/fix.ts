// Shared types for the premium fix flow (AI agent fixes failing checks → PR).
// Mirror the Prisma enums in @repo/db so frontend/backend/workers agree.

export type FixRunState =
  | "QUEUED"
  | "SCANNING"
  | "CLONING"
  | "FIXING"
  | "VERIFYING"
  | "PUSHING"
  | "PR_OPENED"
  | "COMPLETED"
  | "FAILED";

export type SandboxStatus = "NONE" | "CREATING" | "RUNNING" | "KILLED";

export type FixCheckStatus =
  | "PENDING"
  | "FIXING"
  | "FIXED"
  | "SKIPPED"
  | "FLAGGED"
  | "FAILED";

// One check within a run (drives "X of Y fixed").
export interface FixCheckView {
  rubricId: string;
  category: string;
  scope: string;
  tier: string;
  weight: number;
  affectedCount: number;
  status: FixCheckStatus;
  fixed: boolean;
  note: string | null;
}

// A run event (append-only transcript line).
export interface RunEventView {
  seq: number;
  type: string;
  phase: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

// Summary row for the centralized poll (GET /api/fix-runs).
export interface FixRunSummary {
  id: string;
  website: string;
  repoFullName: string;
  state: FixRunState;
  sandboxStatus: SandboxStatus;
  totalChecks: number;
  fixedChecks: number;
  pendingChecks: number;
  prUrl: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// Full detail for one run (GET /api/fix/:id).
export interface FixRunDetail extends FixRunSummary {
  branch: string | null;
  prNumber: number | null;
  sandboxId: string | null;
  checks: FixCheckView[];
  events: RunEventView[];
}

// POST /api/fix request + response.
export interface StartFixRequest {
  website: string;
  repositoryId: string;
}

export interface StartFixResponse {
  fixRunId: string;
  temporalWorkflowId: string;
}
