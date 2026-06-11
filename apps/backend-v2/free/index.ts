
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {config} from "../config"
import { runScrape } from "../temporal/worker/scraper/run";

// Validate that the caller actually sent a website URL. We accept bare hosts
// (example.com) by defaulting the scheme to https, then require a real http(s)
// host with a dotted, multi-label hostname so junk like "foo" is rejected.
const ScanRequestSchema = z.object({
  url: z
    .string({ error: "Provide a website URL." })
    .trim()
    .min(1, "Provide a website URL.")
    .transform((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`))
    .refine((value) => {
      try {
        const parsed = new URL(value);
        const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
        const host = parsed.hostname;
        return isHttp && host.includes(".") && !host.startsWith(".") && !host.endsWith(".");
      } catch {
        return false;
      }
    }, "Enter a valid website URL, for example https://example.com."),
  singlePage: z.boolean().optional(),
  maxPages: z.coerce.number().int().min(1).max(50).optional(),
});

const PORT = config.port || 4000

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
  res.json({ ok: true, service: "geo-repair" });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "geo-repair-free", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

async function handleScan(req: Request, res: Response) {
  const singleQuery = req.query.single === "true" ? true : undefined;
  const parsed = ScanRequestSchema.safeParse({
    url: req.body?.url ?? req.query.url,
    singlePage: req.body?.singlePage ?? singleQuery,
    maxPages: req.body?.maxPages ?? req.query.maxPages,
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request.";
    return res.status(400).json({ error: message });
  }

  const { url, singlePage, maxPages } = parsed.data;

  try {
    const result = await runScrape(url, { singlePage, maxPages });
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed.";
    return res.status(400).json({ error: message });
  }
}

app.get("/scan-website", scanLimiter, handleScan);
app.post("/scan-website", scanLimiter, handleScan);

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
