export type { NormalizedProfile, JwtPayload, AuthProvider } from "@repo/types";

import type { AuthProvider, NormalizedProfile } from "@repo/types";

export interface OAuthProvider {
  readonly name: AuthProvider;
  getAuthorizationUrl(state: string): string;
  handleCallback(code: string): Promise<NormalizedProfile>;
}
