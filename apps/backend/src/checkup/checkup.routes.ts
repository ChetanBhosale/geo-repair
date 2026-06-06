import { Router } from "express";
import { optionalAuth } from "../auth/optional-auth.middleware";
import {
  createCheckup,
  getCheckupReportByKey,
  getCheckupStatusById,
  getScanQuotaStatus,
} from "./checkup.controller";

const router = Router();

// optionalAuth so signed-in visitors get the per-user quota; anonymous visitors
// fall back to the per-IP allowance.
router.post("/checkups", optionalAuth, createCheckup);
router.get("/scan-quota", optionalAuth, getScanQuotaStatus);
router.get("/checkups/:workflowId/status", getCheckupStatusById);
router.get("/checkup-reports/:key", getCheckupReportByKey);

export default router;
