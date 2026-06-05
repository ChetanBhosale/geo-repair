import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware";
import {
  createShareLink,
  downloadPublicSharedReport,
  downloadReport,
  generateReports,
  getPublicSharedReport,
  getReport,
  listReports,
  revokeShareLink,
} from "./report.controller";

const router = Router();

router.get("/reports/share/:token/download", downloadPublicSharedReport);
router.get("/reports/share/:token", getPublicSharedReport);

router.get("/reports", requireAuth, listReports);
router.post("/reports/generate", requireAuth, generateReports);
router.get("/reports/:reportId/download", requireAuth, downloadReport);
router.post("/reports/:reportId/share-link", requireAuth, createShareLink);
router.delete("/reports/:reportId/share-link", requireAuth, revokeShareLink);
router.get("/reports/:reportId", requireAuth, getReport);

export default router;
