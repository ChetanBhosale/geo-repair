import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  getScraping,
  getScrapingReconcile,
} from "../controllers/scraping.controller";

const router = Router();

router.get("/:id", requireAuth, getScraping);
router.get("/:id/reconcile", requireAuth, getScrapingReconcile);

export default router;
