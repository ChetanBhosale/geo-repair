import type { OAuthProvider } from "./types";
import { githubProvider } from "./github";
import { googleProvider } from "./google";

const providers: Record<string, OAuthProvider> = {
  github: githubProvider,
  google: googleProvider,
};

export function getProvider(slug: string): OAuthProvider | null {
  return providers[slug] ?? null;
}
