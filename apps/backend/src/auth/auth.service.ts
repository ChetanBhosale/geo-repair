import { prisma } from "@repo/db";
import type { NormalizedProfile } from "./types";

export async function upsertUserFromProfile(profile: NormalizedProfile) {
  const existingAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    include: { user: true },
  });

  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: {
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken ?? null,
        scope: profile.scope ?? null,
      },
    });
    return existingAccount.user;
  }

  let user = profile.email
    ? await prisma.user.findUnique({ where: { email: profile.email } })
    : null;

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: profile.email,
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
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken ?? null,
      scope: profile.scope ?? null,
    },
  });

  return user;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
