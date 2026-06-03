import type { OAuthProvider } from "../types";
import { githubProvider } from "./github";

// Add new providers here (google, framer, wordpress) and they flow through
// the whole auth system automatically.
const providers: Record<string, OAuthProvider> = {
  github: githubProvider,
};

export function getProvider(slug: string): OAuthProvider | null {
  return providers[slug] ?? null;
}

export function isSupportedProvider(slug: string): boolean {
  return slug in providers;
}
