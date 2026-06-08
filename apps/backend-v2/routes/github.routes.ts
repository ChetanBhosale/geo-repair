import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { listRepos } from "../controllers/github.controller";

const router = Router();

router.get("/repos", requireAuth, listRepos);

export default router;
