import Secrets from "@repo/secrets/backend";
import type { NormalizedProfile, OAuthProvider } from "./types";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
}

export const googleProvider: OAuthProvider = {
  name: "GOOGLE",

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: Secrets.GOOGLE_CLIENT_ID ?? "",
      redirect_uri: Secrets.GOOGLE_REDIRECT_URL,
      response_type: "code",
      scope: "openid email profile",
      state,
      // access_type=offline + prompt=consent so we get a refresh token.
      access_type: "offline",
      prompt: "consent",
    });
    return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
  },

  async handleCallback(code: string): Promise<NormalizedProfile> {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Secrets.GOOGLE_CLIENT_ID ?? "",
        client_secret: Secrets.GOOGLE_CLIENT_SECRET ?? "",
        code,
        grant_type: "authorization_code",
        redirect_uri: Secrets.GOOGLE_REDIRECT_URL,
      }),
    });

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenData.access_token) {
      throw new Error(
        `Google token exchange failed: ${tokenData.error_description ?? tokenData.error ?? "unknown error"}`,
      );
    }

    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userRes.ok) {
      throw new Error(`Google userinfo fetch failed: ${userRes.status}`);
    }

    const user = (await userRes.json()) as GoogleUserInfo;

    const accessTokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    return {
      provider: "GOOGLE",
      providerAccountId: user.sub,
      email: user.email ?? null,
      emailVerified: user.email_verified === true,
      name: user.name ?? user.given_name ?? null,
      username: null,
      avatarUrl: user.picture ?? null,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      accessTokenExpiresAt,
      tokenType: tokenData.token_type ?? null,
      scope: tokenData.scope ?? null,
    };
  },
};
