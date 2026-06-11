import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";

import { config } from "../config";
import { createScanRouter } from "../routes/scan.routes";

const PORT = config.port || 4000;

const app = express();

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "geo-repair" });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "geo-repair-free", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// The public scan API. Same router the main API (api.geo.repair) mounts — it
// carries its own open CORS, JSON parser, and 3-scans/min rate limit.
app.use("/scan-website", createScanRouter());

// 404 + error handlers.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found." });
});
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal error.";
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`[free] geo-repair free checkup listening on port ${PORT}`);
});

export { app };
