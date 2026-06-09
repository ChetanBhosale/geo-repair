// Small GitHub REST helpers used by the agent flows.

export interface PrStatus {
  merged: boolean;
  // open | closed (GitHub's PR state).
  state: string;
}

// Look up a pull request's merge status. Returns null on any error (network /
// 404 / no token) so callers can degrade gracefully.
export async function getPrStatus(
  owner: string,
  repo: string,
  prNumber: number,
  token: string | null | undefined,
): Promise<PrStatus | null> {
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "geo-repair",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { merged?: boolean; merged_at?: string | null; state?: string };
    return {
      merged: body.merged === true || !!body.merged_at,
      state: body.state ?? "open",
    };
  } catch {
    return null;
  }
}
