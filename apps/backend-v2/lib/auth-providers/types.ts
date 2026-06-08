import type { AuthProvider, NormalizedProfile } from "@repo/types/auth";

export type { AuthProvider, NormalizedProfile };

export interface OAuthProvider {
  readonly name: AuthProvider;
  getAuthorizationUrl(state: string): string;
  handleCallback(code: string): Promise<NormalizedProfile>;
}
