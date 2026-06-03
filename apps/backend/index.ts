import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import Secrets from "@repo/secrets/backend";
import authRoutes from "./src/auth/auth.routes";
import auditRoutes from "./src/audit/audit.routes";
import { notFoundHandler, errorHandler } from "./src/middleware/error";
import { authRateLimiter, globalRateLimiter } from "./src/middleware/rate-limit";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.set("trust proxy", 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const ALLOWED_ORIGINS = [Secrets.FRONTEND_URL, "http://localhost:3000"].filter(
  Boolean
) as string[];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());
app.use(globalRateLimiter);

app.get("/health", (_req, res) => {
  res.status(200).json({ message: "working" });
});

app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api", auditRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
