import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { config } from "./config";
import { authRateLimiter, globalRateLimiter } from "./middlewares/rate-limit";
import { errorHandler, notFoundHandler } from "./middlewares/error";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import githubRoutes from "./routes/github.routes";
import projectRoutes from "./routes/projects.routes";
import scrapingRoutes from "./routes/scrapings.routes";
import agentRunRoutes from "./routes/agent-runs.routes";
import workerStatusRoutes from "./routes/worker-status.routes";
import featureInterestRoutes from "./routes/feature-interest.routes";
import {
  billingRoutes,
  devBillingRoutes,
  dodoWebhookRoutes,
} from "./routes/billing.routes";
import { createScanRouter } from "./routes/scan.routes";

const app = express();

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Public, unauthenticated scan API. Mounted BEFORE the restrictive global CORS
// so agents on any origin (and server-side callers) can reach it at
// api.geo.repair/scan-website. Carries its own open CORS, JSON parser, and rate
// limit — the same handler the standalone `free/` service exposes.
app.use("/scan-website", createScanRouter());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(
  "/api/webhooks/dodo",
  express.raw({ type: "application/json" }),
  dodoWebhookRoutes,
);

app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());
app.use(globalRateLimiter);

app.use(healthRoutes);
app.use("/api", billingRoutes);
app.use("/api", devBillingRoutes);
app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/scrapings", scrapingRoutes);
app.use("/api/agent-runs", agentRunRoutes);
app.use("/api/worker-status", workerStatusRoutes);
app.use("/api/feature-interests", featureInterestRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`backend-v2 listening on port ${config.port}`);
});

export { app };
