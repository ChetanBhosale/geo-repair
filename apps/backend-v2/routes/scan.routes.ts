import { Router, type Request, type Response } from "express";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";

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

// Public, unauthenticated scan route. Returns the full readiness report as JSON
// (`runScrape`'s ScrapeResult). Self-contained so it can be mounted on BOTH the
// main API (api.geo.repair) and the standalone `free/` service: it carries its
// own permissive CORS, JSON body parser, and rate limit and depends on no
// app-level middleware. Mount it BEFORE any restrictive global CORS so callers
// on any origin can reach it.
export function createScanRouter(): Router {
  const router = Router();

  // Open CORS: any origin, no credentials. Lets browser agents on any domain —
  // and server-side callers with no Origin header (curl, agent runtimes) — call it.
  router.use(cors({ origin: true, credentials: false }));
  router.use(express.json({ limit: "16kb" }));

  // Rate limit: 3 scans per minute per IP.
  router.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 3,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Rate limit exceeded: max 3 scans per minute. Please try again shortly." },
    }),
  );

  router.get("/", handleScan);
  router.post("/", handleScan);

  return router;
}
