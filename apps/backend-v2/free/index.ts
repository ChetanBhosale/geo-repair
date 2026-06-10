
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { runScrape } from "../temporal/worker/scraper/run";

const PORT = Number(process.env.PORT ?? process.env.FREE_PORT ?? 4100);

const app = express();

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: "16kb" }));

// API rate limit: 3 requests per minute per IP.
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Rate limit exceeded: max 3 scans per minute. Please try again shortly." },
});

app.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "geo-repair-free", endpoint: "POST /scan-website { url }" });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "geo-repair-free", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

async function handleScan(req: Request, res: Response) {
  const url = (req.body?.url ?? req.query.url) as string | undefined;
  if (!url || typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "Provide a website URL via { url } or ?url=." });
  }

  const singlePage = req.body?.singlePage === true || req.query.single === "true";
  const requested = Number(req.body?.maxPages ?? req.query.maxPages);
  const maxPages = Number.isFinite(requested) ? Math.max(1, requested) : undefined;

  try {
    const result = await runScrape(url, { singlePage, maxPages });
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed.";
    return res.status(400).json({ error: message });
  }
}

app.get("/scan-website", scanLimiter, handleScan);

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
