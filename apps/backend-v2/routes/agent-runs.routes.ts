import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { getAgentRun, postFix } from "../controllers/agent-plan.controller";

const router = Router();

router.get("/:id", requireAuth, getAgentRun);
router.post("/:id/fix", requireAuth, postFix);

export default router;
