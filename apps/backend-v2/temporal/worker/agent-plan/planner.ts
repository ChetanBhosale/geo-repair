import { chat } from "@repo/ai";
import type {
  PlanCheckInput,
  PlanOption,
  PlanTargetPage,
  PlannedCheck,
} from "./types";

// Decide the plan for ONE check from its scan finding + rubric metadata. This is
// the unit Temporal registers as the per-check activity. Deterministic for now;
// the body is the seam where an LLM/sandbox planner plugs in later (same return
// shape). It mirrors prompts/planner.md: AUTO vs NEEDS_INPUT vs MANUAL.

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

// Map the affected pages to the files/routes the fix will touch. add_page work
// creates a new route; everything else modifies the existing page.
function targetPagesFor(check: PlanCheckInput): PlanTargetPage[] {
  const action: PlanTargetPage["action"] =
    check.recommendedAction === "add_page" ? "create" : "modify";

  if (check.affectedPages.length > 0) {
    return check.affectedPages.slice(0, 25).map((p) => ({
      url: p.page,
      action,
      reason: p.issue,
    }));
  }

  // Site-wide checks with no per-page rows: one shared edit lifts every page.
  const base = check.affectedPages[0]?.page ?? "";
  return [
    {
      url: base,
      action,
      reason:
        check.scope === "site-wide"
          ? `Site-wide fix in shared config/layout; lifts every page for ${check.rubricId}.`
          : check.summary,
    },
  ];
}

// The interactive ask for a NEEDS_INPUT check (net-new content / a judgment the
// user must make). Three standard options; the safe default is listed first.
function questionFor(check: PlanCheckInput): {
  question: string;
  options: PlanOption[];
} {
  const ask =
    check.recommendation ??
    `${check.rubricId} needs net-new content to reach a full pass. May the agent add it?`;
  return {
    question: ask,
    options: [
      {
        id: "yes_existing",
        label: "Recommended: Yes, only from content already on the site",
        description: "Surface / mark up existing content; nothing invented.",
      },
      {
        id: "yes_provided",
        label: "Yes, and I'll provide the details",
        description: "You give the facts; the agent writes it in your voice.",
      },
      {
        id: "no",
        label: "No, skip this",
        description:
          "Recorded as declined, so the score won't reach 100 for this check.",
      },
    ],
  };
}

export function planCheck(check: PlanCheckInput): PlannedCheck {
  // Out of scope / not safely fixable in code -> manual item, no plan action.
  if (check.fixableByAgent === "false" || check.tier === "out-of-scope") {
    return {
      kind: "manual",
      rubricId: check.rubricId,
      reason:
        check.recommendation ??
        check.summary ??
        `${check.rubricId} cannot be fixed safely in code.`,
    };
  }

  const targetPages = targetPagesFor(check);
  const needsInput =
    check.recommendedAction === "add_page" ||
    check.recommendedAction === "add_content";

  if (needsInput) {
    const { question, options } = questionFor(check);
    return {
      kind: "check",
      rubricId: check.rubricId,
      category: check.category,
      tier: check.tier,
      weight: check.weight,
      scanStatus: check.scanStatus,
      fixableByAgent: check.fixableByAgent,
      evidence: check.evidence,
      recommendation: check.recommendation,
      mode: "NEEDS_INPUT",
      approach:
        check.recommendation ??
        `${check.summary} The agent will add this once approved, then verify the build.`,
      targetPages,
      question,
      options,
    };
  }

  // AUTO: structural/markup fix over existing content. No user input needed.
  return {
    kind: "check",
    rubricId: check.rubricId,
    category: check.category,
    tier: check.tier,
    weight: check.weight,
    scanStatus: check.scanStatus,
    fixableByAgent: check.fixableByAgent,
    evidence: check.evidence,
    recommendation: check.recommendation,
    mode: "AUTO",
    approach:
      check.recommendation ??
      `${check.summary} The agent will apply the markup fix and verify the build.`,
    targetPages,
    question: null,
    options: null,
  };
}

export { originOf };

// ---------------------------------------------------------------------------
// AI planner (scan-grounded). One bounded model call per check that returns the
// plan decision + a short "what I'm doing" narration for the chat. Falls back
// to the deterministic planCheck on any error (no key, bad JSON, timeout).
// ---------------------------------------------------------------------------

const PLANNER_SYSTEM = `You are the GEO Repair planning agent. A scan graded a website against our GEO/AEO/SEO rubric. You are given ONE failing check with its evidence, the scan's recommendation, and the affected pages. Decide how to take it to a full pass.

Return ONLY a single JSON object (no markdown, no prose around it) with this shape:
{
  "mode": "AUTO" | "NEEDS_INPUT" | "MANUAL",
  "narration": "one short, friendly, jargon-free sentence describing what you'll do for this check (streams live to the user)",
  "approach": "plain-language description of the exact change that makes this check pass",
  "targetPages": [{ "url": "<affected page url>", "action": "modify" | "create" | "delete", "reason": "why" }],
  "question": "only when mode is NEEDS_INPUT: the yes/no question to ask the user, else null",
  "options": "only when mode is NEEDS_INPUT: [{ \\"id\\": \\"yes_existing|yes_provided|yes|no\\", \\"label\\": \\"...\\", \\"description\\": \\"...\\" }], else null",
  "manualReason": "only when mode is MANUAL: why it can't be fixed safely in code, else null"
}

Rules:
- mode AUTO = safe structural/markup fix over existing content (metadata, JSON-LD, robots, sitemap, llms.txt, canonical, alt text, semantic HTML, charset, doctype, viewport). No user input.
- mode NEEDS_INPUT = needs net-new content or a judgment only the user can make (e.g. adding an FAQ, adding citations). Always offer a safe default first and a "No, skip this" option.
- mode MANUAL = impossible to do safely in code (e.g. client-rendered SPA -> SSR rearchitecture, responsive/CSS layout).
- Use ONLY the affected pages given for targetPages. Never invent claims, content, or sources.
- Aim for a full pass, not a half measure.`;

interface AiPlanJson {
  mode?: string;
  narration?: string;
  approach?: string;
  targetPages?: PlanTargetPage[];
  question?: string | null;
  options?: PlanOption[] | null;
  manualReason?: string | null;
}

function parseJsonObject(raw: string): AiPlanJson | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(trimmed) as AiPlanJson;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as AiPlanJson;
    } catch {
      return null;
    }
  }
}

export interface AiPlanResult {
  planned: PlannedCheck;
  narration: string;
}

// Plan one check with the model. Throws if the model is unavailable so the
// activity can fall back to the deterministic planner.
export async function aiPlanCheck(check: PlanCheckInput): Promise<AiPlanResult> {
  const raw = await chat(
    [
      { role: "system", content: PLANNER_SYSTEM },
      {
        role: "user",
        content: `Plan this check and return the JSON object only:\n\n${JSON.stringify(
          check,
          null,
          2,
        )}`,
      },
    ],
    { temperature: 0, max_tokens: 800 },
  );

  const parsed = parseJsonObject(raw);
  if (!parsed) throw new Error("Planner returned unparseable output");

  const rubricBase = {
    rubricId: check.rubricId,
    category: check.category,
    tier: check.tier,
    weight: check.weight,
    scanStatus: check.scanStatus,
    fixableByAgent: check.fixableByAgent,
    evidence: check.evidence,
    recommendation: check.recommendation,
  };

  const narration =
    parsed.narration?.trim() ||
    `Planning ${check.rubricId}: ${parsed.approach ?? check.summary}`;

  // Guard against the model trying to "fix" what the rubric says it can't.
  const forcedManual =
    check.fixableByAgent === "false" || check.tier === "out-of-scope";
  const mode = forcedManual ? "MANUAL" : (parsed.mode ?? "AUTO").toUpperCase();

  if (mode === "MANUAL") {
    return {
      narration,
      planned: {
        kind: "manual",
        rubricId: check.rubricId,
        reason:
          parsed.manualReason?.trim() ||
          check.recommendation ||
          check.summary ||
          `${check.rubricId} cannot be fixed safely in code.`,
      },
    };
  }

  const targetPages =
    Array.isArray(parsed.targetPages) && parsed.targetPages.length > 0
      ? parsed.targetPages
      : targetPagesFor(check);

  if (mode === "NEEDS_INPUT") {
    const fallbackQ = questionFor(check);
    return {
      narration,
      planned: {
        kind: "check",
        ...rubricBase,
        mode: "NEEDS_INPUT",
        approach: parsed.approach?.trim() || check.summary,
        targetPages,
        question: parsed.question?.trim() || fallbackQ.question,
        options:
          Array.isArray(parsed.options) && parsed.options.length > 0
            ? parsed.options
            : fallbackQ.options,
      },
    };
  }

  return {
    narration,
    planned: {
      kind: "check",
      ...rubricBase,
      mode: "AUTO",
      approach: parsed.approach?.trim() || check.summary,
      targetPages,
      question: null,
      options: null,
    },
  };
}
