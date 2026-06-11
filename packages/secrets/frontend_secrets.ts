/**
 * Frontend secrets.
 *
 * IMPORTANT: This file is bundled into the browser. Do NOT import `dotenv`
 * or any Node-only module here. Only `NEXT_PUBLIC_*` variables are exposed,
 * and Next.js inlines these static `process.env.NEXT_PUBLIC_*` references at
 * build time.
 */
const FrontendSecrets = {
  PUBLIC_BACKEND: process.env.NEXT_PUBLIC_BACKEND_URL,
  PUBLIC_WS_URL: process.env.NEXT_PUBLIC_BACKEND_WS_URL,
  // Free AI-search checkup service (the `free/` server in backend-v2).
  OPEN_BACKEND: process.env.NEXT_PUBLIC_OPEN_BACKEND_API,
  // Metered TURN. The apiKey is credential-scoped and browser-safe.
  METERED_TURN_URL: process.env.NEXT_PUBLIC_METERED_TURN_URL,
  METERED_API_KEY: process.env.NEXT_PUBLIC_METERED_API_KEY,
};

export default FrontendSecrets;
