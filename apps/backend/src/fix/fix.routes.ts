import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import {
  createFix,
  listFixRuns,
  getFixRun,
  submitFixIntake,
  sendFixMessage,
} from "./fix.controller";

const router = Router();

router.post("/fix", requireAuth, createFix);
router.get("/fix-runs", requireAuth, listFixRuns);
router.post("/fix/:fixRunId/intake", requireAuth, submitFixIntake);
router.post("/fix/:fixRunId/messages", requireAuth, sendFixMessage);
router.get("/fix/:fixRunId", requireAuth, getFixRun);

export default router;
