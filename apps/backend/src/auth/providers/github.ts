import Secrets from "@repo/secrets/backend";
import type { NormalizedProfile, OAuthProvider } from "../types";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export const githubProvider: OAuthProvider = {
  name: "GITHUB",

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: Secrets.GITHUB_CLIENT_ID ?? "",
      redirect_uri: Secrets.GITHUB_CALLBACK_URL,
      // read:user + user:email for login, repo to list/select the user's repos.
      scope: "read:user user:email repo",
      state,
      allow_signup: "true",
    });
    return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
  },

  async handleCallback(code: string): Promise<NormalizedProfile> {
    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Secrets.GITHUB_CLIENT_ID,
        client_secret: Secrets.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: Secrets.GITHUB_CALLBACK_URL,
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenData.access_token) {
      throw new Error(
        `GitHub token exchange failed: ${tokenData.error_description ?? tokenData.error ?? "unknown error"}`
      );
    }

    const accessToken = tokenData.access_token;

    const userRes = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "geo-repair",
      },
    });

    if (!userRes.ok) {
      throw new Error(`GitHub user fetch failed: ${userRes.status}`);
    }

    const user = (await userRes.json()) as GitHubUser;

    let email = user.email;
    if (!email) {
      const emailRes = await fetch(GITHUB_EMAILS_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "geo-repair",
        },
      });
      if (emailRes.ok) {
        const emails = (await emailRes.json()) as GitHubEmail[];
        const primary = emails.find((e) => e.primary && e.verified);
        email = primary?.email ?? emails.find((e) => e.verified)?.email ?? null;
      }
    }

    return {
      provider: "GITHUB",
      providerAccountId: String(user.id),
      email,
      name: user.name,
      username: user.login,
      avatarUrl: user.avatar_url,
      accessToken,
      scope: tokenData.scope ?? null,
    };
  },
};
