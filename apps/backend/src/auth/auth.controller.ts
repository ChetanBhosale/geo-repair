import type { Request, Response } from "express";
import crypto from "crypto";
import Secrets from "@repo/secrets/backend";
import { getProvider } from "./providers";
import { upsertUserFromProfile, getUserById } from "./auth.service";
import { signToken, verifyToken, AUTH_COOKIE } from "./jwt";

const STATE_COOKIE = "oauth_state";
const isProd = process.env.NODE_ENV === "production";

function sessionCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ("none" as const) : ("lax" as const),
    maxAge: maxAgeMs,
    path: "/",
  };
}

function stateCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    maxAge: maxAgeMs,
    path: "/",
  };
}

export function startOAuth(req: Request, res: Response) {
  const provider = getProvider(String(req.params.provider ?? ""));
  if (!provider) {
    return res.status(404).json({ error: "Unsupported auth provider" });
  }

  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, stateCookieOptions(10 * 60 * 1000));

  return res.redirect(provider.getAuthorizationUrl(state));
}

export async function handleOAuthCallback(req: Request, res: Response) {
  const provider = getProvider(String(req.params.provider ?? ""));
  if (!provider) {
    return res.status(404).json({ error: "Unsupported auth provider" });
  }

  const { code, state } = req.query as { code?: string; state?: string };
  const expectedState = req.cookies?.[STATE_COOKIE];

  if (!code) {
    return redirectWithError(res, "missing_code");
  }
  if (!state || !expectedState || state !== expectedState) {
    return redirectWithError(res, "invalid_state");
  }

  res.clearCookie(STATE_COOKIE, { path: "/" });

  try {
    const profile = await provider.handleCallback(code);
    const user = await upsertUserFromProfile(profile);

    const token = signToken({ sub: user.id, email: user.email });
    res.cookie(AUTH_COOKIE, token, sessionCookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.redirect(`${Secrets.FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error("[auth] OAuth callback error:", err);
    return redirectWithError(res, "oauth_failed");
  }
}

export async function getMe(req: Request, res: Response) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const user = await getUserById(payload.sub);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      avatarUrl: user.avatarUrl,
    },
  });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  return res.json({ success: true });
}

function redirectWithError(res: Response, code: string) {
  return res.redirect(`${Secrets.FRONTEND_URL}/?auth_error=${code}`);
}
