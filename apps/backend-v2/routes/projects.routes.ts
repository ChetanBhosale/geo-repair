import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  postProject,
  getProjects,
  getProjectById,
  deleteProjectById,
} from "../controllers/project.controller";
import { postScan, getProjectScraping, getProjectScrapings } from "../controllers/scraping.controller";

const router = Router();

router.post("/", requireAuth, postProject);
router.get("/", requireAuth, getProjects);
router.get("/:id", requireAuth, getProjectById);
router.delete("/:id", requireAuth, deleteProjectById);
router.post("/:id/scan", requireAuth, postScan);
router.get("/:id/scraping", requireAuth, getProjectScraping);
router.get("/:id/scrapings", requireAuth, getProjectScrapings);

export default router;
