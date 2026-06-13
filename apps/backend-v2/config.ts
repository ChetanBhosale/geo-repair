import Secrets from "@repo/secrets/backend";

// Single typed view of the runtime config this service needs. Everything reads
// from here instead of touching process.env directly.
export const config = {
  nodeEnv: Secrets.NODE_ENV,
  isProd: Secrets.NODE_ENV === "production",
  port: Number(process.env.PORT_V2 ?? process.env.PORT ?? 4000),

  // Browser origins allowed to call this API with credentials.
  allowedOrigins: [
    Secrets.FRONTEND_URL,
    Secrets.WEB_URL,
    Secrets.DASHBOARD_URL,
    "http://localhost:3000",
    "http://localhost:3001",
  ].filter(Boolean) as string[],
} as const;
