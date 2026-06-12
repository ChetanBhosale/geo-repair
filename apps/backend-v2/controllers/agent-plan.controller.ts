import type { Request, Response } from "express";
import {
  AgentPlanError,
  completeAgentRun,
  getAgentRunDetail,
  listAgentRuns,
  startAgentPlan,
} from "../functions/agent-plan.service";
import { FixError, startFix } from "../functions/fix.service";
import { ChatError, startChat } from "../functions/chat.service";

// POST /api/projects/:id/agent-plan
// Kicks off a planning run for the project's latest completed scan. Enqueues the
// agent-plan workflow and returns the run + plan ids immediately so the UI polls.
export async function postAgentPlan(req: Request, res: Response) {
  const userId = req.userId!;
  const projectId = String(req.params.id ?? "");
  const orderId = String(req.body?.orderId ?? "").trim();
  if (!orderId) {
    return res.status(400).json({ error: "orderId is required." });
  }

  try {
    const result = await startAgentPlan(userId, projectId, orderId);
    return res.status(202).json(result);
  } catch (err) {
    if (err instanceof AgentPlanError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to start planning",
    });
  }
}

// GET /api/projects/:id/agent-runs -> run history (newest first)
export async function getProjectAgentRuns(req: Request, res: Response) {
  const userId = req.userId!;
  const projectId = String(req.params.id ?? "");
  const agentRuns = await listAgentRuns(userId, projectId);
  return res.json({ agentRuns });
}

// GET /api/agent-runs/:id -> one run with its plan + checks + chat logs
export async function getAgentRun(req: Request, res: Response) {
  const userId = req.userId!;
  const id = String(req.params.id ?? "");
  const agentRun = await getAgentRunDetail(userId, id);
  if (!agentRun) return res.status(404).json({ error: "Agent run not found" });
  return res.json({ agentRun });
}

// POST /api/agent-runs/:id/fix -> submit plan answers + start the fix run
export async function postFix(req: Request, res: Response) {
  const userId = req.userId!;
  const id = String(req.params.id ?? "");
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
  try {
    const result = await startFix(userId, id, answers);
    return res.status(202).json(result);
  } catch (err) {
    if (err instanceof FixError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to start fix run",
    });
  }
}

// POST /api/agent-runs/:id/chat -> one post-PR chat turn
export async function postAgentChat(req: Request, res: Response) {
  const userId = req.userId!;
  const id = String(req.params.id ?? "");
  const message = String(req.body?.message ?? "");
  try {
    const result = await startChat(userId, id, message);
    return res.status(202).json(result);
  } catch (err) {
    if (err instanceof ChatError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to send message",
    });
  }
}

// POST /api/agent-runs/:id/complete -> mark the run done so a new one can start
export async function postCompleteRun(req: Request, res: Response) {
  const userId = req.userId!;
  const id = String(req.params.id ?? "");
  try {
    const result = await completeAgentRun(userId, id);
    return res.json(result);
  } catch (err) {
    if (err instanceof AgentPlanError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to complete run",
    });
  }
}
