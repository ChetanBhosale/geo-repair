import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  postProject,
  getProjects,
  getProjectBySlugForUser,
  getProjectById,
  getSelectedProjectForUser,
  deleteProjectById,
  selectProjectById,
} from "../controllers/project.controller";
import {
  postScan,
  getProjectScraping,
  getProjectScrapingBySlug,
  getProjectScrapings,
} from "../controllers/scraping.controller";
import {
  postAgentPlan,
  getProjectAgentRunBySlug,
  getProjectAgentRuns,
} from "../controllers/agent-plan.controller";

const router = Router();

router.post("/", requireAuth, postProject);
router.get("/", requireAuth, getProjects);
router.get("/selected", requireAuth, getSelectedProjectForUser);
router.get("/by-slug/:slug", requireAuth, getProjectBySlugForUser);
router.get("/:id", requireAuth, getProjectById);
router.post("/:id/select", requireAuth, selectProjectById);
router.delete("/:id", requireAuth, deleteProjectById);
router.post("/:id/scan", requireAuth, postScan);
router.get("/:id/scraping", requireAuth, getProjectScraping);
router.get("/:id/scrapings", requireAuth, getProjectScrapings);
router.get("/:id/scrapings/:slug", requireAuth, getProjectScrapingBySlug);
router.post("/:id/agent-plan", requireAuth, postAgentPlan);
router.get("/:id/agent-runs", requireAuth, getProjectAgentRuns);
router.get("/:id/agent-runs/:slug", requireAuth, getProjectAgentRunBySlug);

export default router;
