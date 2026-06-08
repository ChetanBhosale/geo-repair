import jwt, { type SignOptions } from "jsonwebtoken";
import Secrets from "@repo/secrets/backend";
import type { JwtPayload } from "@repo/types/auth";

const SECRET = Secrets.JWT_SECRET;

export const AUTH_COOKIE = "geo_repair_session";

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, {
    expiresIn: Secrets.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
