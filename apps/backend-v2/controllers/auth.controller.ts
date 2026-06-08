import type { Request, Response } from "express";
import crypto from "crypto";
import Secrets from "@repo/secrets/backend";
import { getProvider } from "../lib/auth-providers";
import { upsertUserFromProfile, getUserById } from "../functions/auth.service";
import { signToken, verifyToken, AUTH_COOKIE } from "../lib/jwt";
import { config } from "../config";

const STATE_COOKIE = "oauth_state";
const REDIRECT_COOKIE = "oauth_redirect_to";

function sessionCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? ("none" as const) : ("lax" as const),
    maxAge: maxAgeMs,
    path: "/",
  };
}

function stateCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "lax" as const,
    maxAge: maxAgeMs,
    path: "/",
  };
}

function safeDashboardPath(value: unknown): string {
  if (typeof value !== "string") return "/dashboard";
  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    /[\r\n]/.test(trimmed)
  ) {
    return "/dashboard";
  }
  return trimmed.slice(0, 512);
}

// GET /api/auth/:provider — begin the OAuth dance.
export function startOAuth(req: Request, res: Response) {
  const provider = getProvider(String(req.params.provider ?? ""));
  if (!provider) {
    return res.status(404).json({ error: "Unsupported auth provider" });
  }

  const state = crypto.randomBytes(16).toString("hex");
  const redirectTo = safeDashboardPath(req.query.redirect_to);
  res.cookie(STATE_COOKIE, state, stateCookieOptions(10 * 60 * 1000));
  res.cookie(REDIRECT_COOKIE, redirectTo, stateCookieOptions(10 * 60 * 1000));

  return res.redirect(provider.getAuthorizationUrl(state));
}

// GET /api/auth/:provider/callback — exchange code, link/create user, set session.
export async function handleOAuthCallback(req: Request, res: Response) {
  const provider = getProvider(String(req.params.provider ?? ""));
  if (!provider) {
    return res.status(404).json({ error: "Unsupported auth provider" });
  }

  const { code, state } = req.query as { code?: string; state?: string };
  const expectedState = req.cookies?.[STATE_COOKIE];

  if (!code) return redirectWithError(res, "missing_code");
  if (!state || !expectedState || state !== expectedState) {
    return redirectWithError(res, "invalid_state");
  }

  res.clearCookie(STATE_COOKIE, { path: "/" });
  const redirectTo = safeDashboardPath(req.cookies?.[REDIRECT_COOKIE]);
  res.clearCookie(REDIRECT_COOKIE, { path: "/" });

  // If the user is already logged in, link this provider to that same user
  // (e.g. signed in with Google, now connecting GitHub for repo access).
  const sessionToken = req.cookies?.[AUTH_COOKIE];
  const currentUserId = sessionToken
    ? (verifyToken(sessionToken)?.sub ?? undefined)
    : undefined;

  try {
    const profile = await provider.handleCallback(code);
    const user = await upsertUserFromProfile(profile, { currentUserId });

    const token = signToken({ sub: user.id, email: user.email });
    res.cookie(AUTH_COOKIE, token, sessionCookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.redirect(`${Secrets.DASHBOARD_URL}${redirectTo}`);
  } catch (err) {
    console.error("[auth] OAuth callback error:", err);
    return redirectWithError(res, "oauth_failed");
  }
}

// GET /api/auth/me
export async function getMe(req: Request, res: Response) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const user = await getUserById(payload.sub);
  if (!user) return res.status(401).json({ error: "User not found" });

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

// POST /api/auth/logout
export function logout(_req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  return res.json({ success: true });
}

function redirectWithError(res: Response, code: string) {
  return res.redirect(`${Secrets.DASHBOARD_URL}/onboarding?auth_error=${code}`);
}
