import { z } from "zod";
import { AuthProviderSchema } from "./auth";

// Public user shape returned by the API. Never includes tokens.
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
});
export type User = z.infer<typeof UserSchema>;

// A linked OAuth account (safe fields only).
export const AccountSchema = z.object({
  id: z.string(),
  provider: AuthProviderSchema,
  providerAccountId: z.string(),
});
export type Account = z.infer<typeof AccountSchema>;

// Response body for GET /api/auth/me.
export const MeResponseSchema = z.object({
  user: UserSchema,
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

// Generic API error envelope.
export const ApiErrorSchema = z.object({
  error: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
