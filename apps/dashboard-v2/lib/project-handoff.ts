import type { GithubRepo } from "@repo/types/github"

export function stripProtocol(value: string): string {
  return value.replace(/^\s*https?:\/\//i, "").replace(/^\s+/, "")
}

export function websiteInputFromUrl(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return ""

  try {
    const parsed = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    )
    return parsed.hostname
  } catch {
    return stripProtocol(trimmed).split(/[/?#]/)[0] ?? ""
  }
}

export function findAutoCreateRepoForWebsite(
  website: string | null | undefined,
  repos: GithubRepo[]
): GithubRepo | null {
  const candidates = websiteRepoCandidates(website)
  if (candidates.size === 0) return null

  const matches = repos.filter((repo) =>
    repoNameCandidates(repo).some((name) => candidates.has(normalizeName(name)))
  )

  return matches.length === 1 ? matches[0] : null
}

function websiteRepoCandidates(
  website: string | null | undefined
): Set<string> {
  const hostname = websiteInputFromUrl(website)
    .toLowerCase()
    .replace(/^www\./, "")
  if (!hostname) return new Set()

  const labels = hostname.split(".").filter(Boolean)
  const hostAsRepo = hostname.replace(/\./g, "-")
  const withoutTld =
    labels.length > 1 ? labels.slice(0, -1).join("-") : labels[0]
  const firstLabel = labels[0]

  const bases = new Set(
    [hostAsRepo, withoutTld, firstLabel].filter(Boolean).map(normalizeName)
  )
  const candidates = new Set(bases)
  for (const base of bases) {
    candidates.add(`${base}-website`)
    candidates.add(`${base}-site`)
    candidates.add(`${base}-web`)
    candidates.add(`${base}-app`)
  }
  return candidates
}

function repoNameCandidates(repo: GithubRepo): string[] {
  return [repo.name, repo.fullName.split("/").at(-1) ?? repo.fullName]
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
