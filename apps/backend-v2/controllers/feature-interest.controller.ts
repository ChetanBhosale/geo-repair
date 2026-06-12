import type { Request, Response } from "express";
import {
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
  const interest = await markAiVisibilityInterest(req.userId!);
  return res.json({ interest });
}
