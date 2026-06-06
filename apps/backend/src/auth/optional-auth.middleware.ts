import type { Request, Response, NextFunction } from "express";
import { verifyToken, AUTH_COOKIE } from "./jwt";

// Like requireAuth, but never blocks: if a valid session cookie is present it
// sets req.userId, otherwise it continues anonymously. Used on the public
// checkup route so signed-in visitors get the higher per-user scan quota while
// anonymous visitors fall back to the per-IP allowance.
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.userId = payload.sub;
  }
  return next();
}
