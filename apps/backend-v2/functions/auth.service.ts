import { prisma } from "@repo/db";
import type { NormalizedProfile } from "@repo/types/auth";

function accountTokenData(profile: NormalizedProfile) {
  return {
    email: profile.email,
    username: profile.username,
    avatarUrl: profile.avatarUrl,
    accessToken: profile.accessToken,
    refreshToken: profile.refreshToken ?? null,
    accessTokenExpiresAt: profile.accessTokenExpiresAt ?? null,
    refreshTokenExpiresAt: profile.refreshTokenExpiresAt ?? null,
    tokenType: profile.tokenType ?? null,
    scope: profile.scope ?? null,
  };
}

// Resolve a provider profile to a User and persist the Account + tokens.
//
// Linking rules:
// - If this provider identity is already linked, refresh its tokens.
// - Else if a session user is supplied (the person is logged in and connecting
//   a second provider), attach the account to THAT user, regardless of email.
// - Else auto-link to an existing user only when the provider VERIFIED the
//   email; otherwise create a fresh user.
export async function upsertUserFromProfile(
  profile: NormalizedProfile,
  opts?: { currentUserId?: string },
) {
  const existing = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    include: { user: true },
  });

  if (existing) {
    await prisma.account.update({
      where: { id: existing.id },
      data: accountTokenData(profile),
    });
    return existing.user;
  }

  let user = opts?.currentUserId
    ? await prisma.user.findUnique({ where: { id: opts.currentUserId } })
    : null;

  if (!user && profile.email && profile.emailVerified) {
    user = await prisma.user.findUnique({ where: { email: profile.email } });
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: profile.email,
        emailVerified: profile.emailVerified ?? false,
        name: profile.name,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
      },
    });
  }

  await prisma.account.create({
    data: {
      userId: user.id,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      ...accountTokenData(profile),
    },
  });

  return user;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
