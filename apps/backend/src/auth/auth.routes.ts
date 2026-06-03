import { Router } from "express";
import {
  startOAuth,
  handleOAuthCallback,
  getMe,
  logout,
} from "./auth.controller";

const router = Router();

router.get("/me", getMe);
router.post("/logout", logout);

router.get("/:provider", startOAuth);
router.get("/:provider/callback", handleOAuthCallback);

export default router;
