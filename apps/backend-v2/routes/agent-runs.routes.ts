import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  getAgentRun,
  postFix,
  postRevalidate,
  postAgentChat,
  postCompleteRun,
} from "../controllers/agent-plan.controller";

const router = Router();

router.get("/:id", requireAuth, getAgentRun);
router.post("/:id/fix", requireAuth, postFix);
router.post("/:id/revalidate", requireAuth, postRevalidate);
router.post("/:id/chat", requireAuth, postAgentChat);
router.post("/:id/complete", requireAuth, postCompleteRun);

export default router;
