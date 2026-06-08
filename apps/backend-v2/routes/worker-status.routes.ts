import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  getWorkerStatus,
  getWorkerStatusByWorkflow,
} from "../controllers/scraping.controller";

const router = Router();

// API 1: active (QUEUED/RUNNING) workers for the live "what's running" panel.
router.get("/", requireAuth, getWorkerStatus);
// API 2: sync one workflow with Temporal and return the refreshed worker item.
router.get("/:workflowId", requireAuth, getWorkerStatusByWorkflow);

export default router;
