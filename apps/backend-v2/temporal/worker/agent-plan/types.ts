// Types for the agent-plan workflow: the per-check input handed to the planner,
// and the planned output that gets persisted as AgentPlanCheck rows (or as a
// manual item on the AgentPlan).

// One failing/MID check from the scan, handed to the planner. A subset of the
// scraper's SiteCheck (Scraping.result.checks[]).
export interface PlanCheckInput {
  rubricId: string; // SiteCheck.name
  category: string;
  tier: string; // A | B | C | out-of-scope
  weight: number;
  scanStatus: string; // SUCCESS | MID | FAILED | NOT_APPLICABLE | INCONCLUSIVE
  fixableByAgent: string; // "true" | "false" | "partial"
  scope: string; // site-wide | per-page
  recommendedAction: string; // none | mark_up_existing | add_content | add_page | flag_only
  summary: string;
  evidence: string | null;
  recommendation: string | null;
  affectedPages: {
    page: string;
    status: string;
    issue: string;
    recommendation: string | null;
  }[];
}

export interface PlanTargetPage {
  url: string;
  action: "modify" | "create" | "delete";
  reason: string;
}

export interface PlanOption {
  id: string;
  label: string;
  description?: string;
}

// The planner's decision for one check. Either a real plan entry (an
// AgentPlanCheck row) or a manual item (recorded on AgentPlan.manual).
export type PlannedCheck =
  | {
      kind: "check";
      rubricId: string;
      category: string;
      tier: string;
      weight: number;
      scanStatus: string;
      fixableByAgent: string;
      evidence: string | null;
      recommendation: string | null;
      mode: "AUTO" | "NEEDS_INPUT";
      approach: string;
      targetPages: PlanTargetPage[];
      question: string | null;
      options: PlanOption[] | null;
    }
  | {
      kind: "manual";
      rubricId: string;
      reason: string;
    };
