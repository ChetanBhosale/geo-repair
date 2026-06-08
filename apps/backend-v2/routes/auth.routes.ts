import { Router } from "express";
import {
  startOAuth,
  handleOAuthCallback,
  getMe,
  logout,
} from "../controllers/auth.controller";
import { listAccounts } from "../controllers/github.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/me", getMe);
router.post("/logout", logout);
router.get("/accounts", requireAuth, listAccounts);
router.get("/:provider", startOAuth);
router.get("/:provider/callback", handleOAuthCallback);

export default router;
