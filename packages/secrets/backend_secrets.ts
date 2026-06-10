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
  WEB_URL:
    process.env.WEB_URL ||
    (isProd ? process.env.FRONTEND_URL : undefined) ||
    "http://localhost:3001",
  DASHBOARD_URL:
    process.env.DASHBOARD_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:3000",
  DATABASE_URL: process.env.DATABASE_URL,

  JWT_SECRET: JWT_SECRET || "dev-insecure-secret-change-me",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL:
    process.env.GITHUB_CALLBACK_URL ||
    "http://localhost:4000/api/auth/github/callback",
  // Owner PAT — fallback git credential for local/owner testing of the fix flow.
  GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,

  // Google OAuth. Note: .env currently has the key as GOOGLE_ClIENT_ID (typo),
  // so we read both spellings.
  GOOGLE_CLIENT_ID:
    process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ClIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URL:
    process.env.GOOGLE_REDIRECT_URL ||
    "http://localhost:4000/api/auth/google/callback",

  // Temporal Cloud (API-key auth).
  TEMPORAL_API_KEY: process.env.TEMPORAL_API_KEY,
  TEMPORAL_ENDPOINT: process.env.TEMPORAL_ENDPOINT,
  TEMPORAL_NAMESPACE: process.env.TEMPORAL_NAMESPACE,

  // OpenRouter (LLM gateway). LLM_MODEL is the default model id.
  OPEN_ROUTER_KEY: process.env.OPEN_ROUTER_KEY,
  LLM_MODEL: process.env.LLM_MODEL || "google/gemini-3.5-flash",
  // Cheaper/faster model for mechanical fix groups (metadata, robots/sitemap/
  // llms.txt). Falls back to LLM_MODEL when unset, so routing is a no-op until
  // configured. Reserve the stronger LLM_MODEL for content/structural edits.
  LLM_MODEL_CHEAP:
    process.env.LLM_MODEL_CHEAP || process.env.LLM_MODEL || "google/gemini-3.5-flash",

  // E2B (ephemeral execution sandbox).
  E2B_SANDBOX_API_KEY: process.env.E2B_SANDBOX_API_KEY,
  E2B_SANDBOX_ID: process.env.E2B_SANDBOX_ID,

  // Google Vertex AI (Imagen image generation). Auth is via a service account:
  // either GOOGLE_APPLICATION_CREDENTIALS (path to key file, picked up by ADC)
  // or GOOGLE_VERTEX_CREDENTIALS (the key JSON inline as a string).
  GOOGLE_VERTEX_PROJECT: process.env.GOOGLE_VERTEX_PROJECT,
  GOOGLE_VERTEX_LOCATION: process.env.GOOGLE_VERTEX_LOCATION || "us-central1",
  GOOGLE_VERTEX_IMAGE_MODEL:
    process.env.GOOGLE_VERTEX_IMAGE_MODEL || "imagen-3.0-generate-002",
  GOOGLE_VERTEX_CREDENTIALS: process.env.GOOGLE_VERTEX_CREDENTIALS,

  // Internal run COGS estimates. Values are cents, not dollars.
  COGS_LLM_INPUT_CENTS_PER_MILLION_TOKENS:
    process.env.COGS_LLM_INPUT_CENTS_PER_MILLION_TOKENS,
  COGS_LLM_OUTPUT_CENTS_PER_MILLION_TOKENS:
    process.env.COGS_LLM_OUTPUT_CENTS_PER_MILLION_TOKENS,
  COGS_E2B_SANDBOX_CENTS_PER_HOUR:
    process.env.COGS_E2B_SANDBOX_CENTS_PER_HOUR,
  COGS_IMAGE_CENTS_PER_THUMBNAIL:
    process.env.COGS_IMAGE_CENTS_PER_THUMBNAIL,

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
