import type { Request, Response } from "express";
import {
  FeatureInterestError,
  getAiVisibilityInterest,
  markAiVisibilityInterest,
} from "../functions/feature-interest.service";

export async function getAiVisibilityInterestState(
  req: Request,
  res: Response,
) {
  const interest = await getAiVisibilityInterest(req.userId!);
  return res.json({ interest });
}

export async function postAiVisibilityInterest(req: Request, res: Response) {
  try {
    const projectId =
      typeof req.body?.projectId === "string" ? req.body.projectId : null;
    const interest = await markAiVisibilityInterest(req.userId!, projectId);
    return res.json({ interest });
  } catch (err) {
    if (err instanceof FeatureInterestError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(400).json({
      error:
        err instanceof Error ? err.message : "Failed to save feature interest",
    });
  }
}
