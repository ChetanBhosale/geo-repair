import type { Request, Response } from "express";
import type { FixRunIntake } from "@repo/types/fix";
import { startFix } from "../temporal";
import { listUserRuns, getRunDetail } from "./fix.service";

function normalizeWebsite(value: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return `${u.protocol}//${u.host}/`;
  } catch {
    return null;
  }
}

function normalizeIntake(value: unknown): FixRunIntake | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const input = value as Partial<FixRunIntake>;
  if (input.version !== 1 || !Array.isArray(input.answers)) {
    return undefined;
  }

  const answers = input.answers
    .slice(0, 10)
    .map((answer) => {
      if (!answer || typeof answer !== "object") return null;
      const item = answer as Partial<FixRunIntake["answers"][number]>;
      if (
        typeof item.questionId !== "string" ||
        typeof item.question !== "string" ||
        typeof item.answerId !== "string" ||
        typeof item.answerLabel !== "string"
      ) {
        return null;
      }

      return {
        questionId: item.questionId,
        question: item.question.slice(0, 240),
        answerId: item.answerId.slice(0, 80),
        answerLabel: item.answerLabel.slice(0, 240),
        notes:
          typeof item.notes === "string" && item.notes.trim()
            ? item.notes.trim().slice(0, 800)
            : null,
      };
    })
    .filter((answer): answer is FixRunIntake["answers"][number] => !!answer);

  if (answers.length === 0) return undefined;

  return {
    version: 1,
    submittedAt:
      typeof input.submittedAt === "string"
        ? input.submittedAt
        : new Date().toISOString(),
    answers,
  };
}

// POST /api/fix  { website, repositoryId } -> { fixRunId, temporalWorkflowId }
export async function createFix(req: Request, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { website, repositoryId, orderId, intake } = req.body as {
    website?: string;
    repositoryId?: string;
    orderId?: string;
    intake?: unknown;
  };
  const normalized = website ? normalizeWebsite(website) : null;
  if (!normalized) {
    return res.status(400).json({ error: "A valid website url is required" });
  }
  if (!repositoryId) {
    return res.status(400).json({ error: "repositoryId is required" });
  }
  if (!orderId) {
    return res.status(400).json({ error: "orderId is required" });
  }

  try {
    const result = await startFix({
      userId,
      website: normalized,
      repositoryId,
      orderId,
      intake: normalizeIntake(intake),
    });
    return res.status(202).json(result);
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to start fix",
    });
  }
}

// GET /api/fix-runs -> all of the user's runs (the centralized poll).
export async function listFixRuns(req: Request, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const runs = await listUserRuns(userId);
  return res.json({ runs });
}

// GET /api/fix/:fixRunId -> one run's full detail.
export async function getFixRun(req: Request, res: Response) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const fixRunId = req.params.fixRunId;
  if (!fixRunId || typeof fixRunId !== "string") {
    return res.status(400).json({ error: "fixRunId is required" });
  }
  const detail = await getRunDetail(userId, fixRunId);
  if (!detail) {
    return res.status(404).json({ error: "Fix run not found" });
  }
  return res.json(detail);
}
