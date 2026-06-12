import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  getAiVisibilityInterestState,
  postAiVisibilityInterest,
} from "../controllers/feature-interest.controller";

const router = Router();

router.get("/ai-visibility", requireAuth, getAiVisibilityInterestState);
router.post("/ai-visibility", requireAuth, postAiVisibilityInterest);

export default router;
