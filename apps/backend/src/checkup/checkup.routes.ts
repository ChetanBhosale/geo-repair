import { Router } from "express";
import {
  createCheckup,
  getCheckupReportByKey,
  getCheckupStatusById,
} from "./checkup.controller";

const router = Router();

router.post("/checkups", createCheckup);
router.get("/checkups/:workflowId/status", getCheckupStatusById);
router.get("/checkup-reports/:key", getCheckupReportByKey);

export default router;
