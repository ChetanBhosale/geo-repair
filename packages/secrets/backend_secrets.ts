import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load the monorepo root .env, resolved relative to this file so it works no
// matter which workspace's process imports it. This is the only place that
// reads .env directly; everything else imports from here.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../apps/web/.env.local") });

const isProd = process.env.NODE_ENV === "production";

const JWT_SECRET = process.env.JWT_SECRET;
if (isProd && (!JWT_SECRET || JWT_SECRET.length < 16)) {
  throw new Error("JWT_SECRET must be set to a strong value in production (>= 16 chars).");
}

const BackendSecrets = {
  NODE_ENV: process.env.NODE_ENV || "development",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  DATABASE_URL: process.env.DATABASE_URL,

  JWT_SECRET: JWT_SECRET || "dev-insecure-secret-change-me",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL:
    process.env.GITHUB_CALLBACK_URL ||
    "http://localhost:4000/api/auth/github/callback",

  // Temporal Cloud (API-key auth).
  TEMPORAL_API_KEY: process.env.TEMPORAL_API_KEY,
  TEMPORAL_ENDPOINT: process.env.TEMPORAL_ENDPOINT,
  TEMPORAL_NAMESPACE: process.env.TEMPORAL_NAMESPACE,

  // Dodo Payments. One-time AI Search Fix checkout only.
  DODO_PAYMENTS_API_KEY: process.env.DODO_PAYMENTS_API_KEY,
  DODO_PAYMENTS_WEBHOOK_KEY: process.env.DODO_PAYMENTS_WEBHOOK_KEY,
  DODO_PAYMENTS_ENVIRONMENT:
    process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode"
      ? "live_mode"
      : "test_mode",
  DODO_PRODUCT_ID_STARTER: process.env.DODO_PRODUCT_ID_STARTER,
  DODO_PRODUCT_ID_GROWTH: process.env.DODO_PRODUCT_ID_GROWTH,
  DODO_PRODUCT_ID_SCALE: process.env.DODO_PRODUCT_ID_SCALE,
  ENABLE_DEV_BILLING_FIXTURES:
    process.env.ENABLE_DEV_BILLING_FIXTURES === "true",
};

export default BackendSecrets;
