import { z } from "zod";

// Supported OAuth providers. Mirrors the Prisma AuthProvider enum.
export const AuthProviderSchema = z.enum([
  "GITHUB",
  "GOOGLE",
  "FRAMER",
  "WORDPRESS",
]);
export type AuthProvider = z.infer<typeof AuthProviderSchema>;

// URL slugs used in routes like /api/auth/:provider.
export const AuthProviderSlugSchema = z.enum([
  "github",
  "google",
  "framer",
  "wordpress",
]);
export type AuthProviderSlug = z.infer<typeof AuthProviderSlugSchema>;

// Normalized profile every provider returns after the OAuth exchange.
export const NormalizedProfileSchema = z.object({
  provider: AuthProviderSchema,
  providerAccountId: z.string(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  accessToken: z.string(),
  refreshToken: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
});
export type NormalizedProfile = z.infer<typeof NormalizedProfileSchema>;

// Payload encoded in the signed JWT session token.
export const JwtPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email().nullable(),
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;
