import { Router } from "express";
import {
  createAudit,
  getTemporalStatus,
  getAuditResultByKey,
} from "./audit.controller";

const router = Router();

router.post("/audit", createAudit);
router.get("/temporal-status/:temporalId", getTemporalStatus);
router.get("/audit-result/:key", getAuditResultByKey);

export default router;
