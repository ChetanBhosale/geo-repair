import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import {
  listRepos,
  selectRepo,
  listSaved,
  updateWebsite,
} from "./github.controller";

const router = Router();

router.get("/repos", requireAuth, listRepos);
router.get("/repos/saved", requireAuth, listSaved);
router.post("/repos/select", requireAuth, selectRepo);
router.patch("/repos/:id/website", requireAuth, updateWebsite);

export default router;
