import { Router, type Request, type Response } from "express";
import { prisma } from "@repo/db";

const router = Router();

// Liveness: the process is up.
router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "backend-v2" });
});

// Readiness: the DB is reachable. Proves the @repo/db wiring works end to end.
router.get("/health/db", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", db: "up" });
  } catch (err) {
    res.status(503).json({
      status: "degraded",
      db: "down",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
