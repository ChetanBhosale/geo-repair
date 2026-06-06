import { prisma } from "@repo/db";
import Secrets from "@repo/secrets/backend";

// Resolve the git credential for a run: prefer the user's stored GitHub OAuth
// token, fall back to the owner PAT for local/owner testing. The long-term path
// is a per-run GitHub App installation token (swap here only).
export async function resolveGitToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "GITHUB" },
    select: { accessToken: true },
  });
  const token = account?.accessToken ?? Secrets.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "No GitHub token available (no OAuth token and no PAT configured)",
    );
  }
  return token;
}
