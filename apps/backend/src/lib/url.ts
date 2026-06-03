// Validates and normalizes a website URL down to its origin root.
// e.g. "linkrunner.io/pages/work" -> "https://linkrunner.io/"
//      "http://example.com/a/b?x=1" -> "http://example.com/"
// Returns null if the input isn't a usable http(s) website.
export function normalizeWebsite(input: string): string | null {
  if (typeof input !== "string") return null;

  const raw = input.trim();
  if (!raw) return null;

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const u = new URL(withProtocol);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    // Must look like a real domain (has a dot, not localhost).
    if (!u.hostname.includes(".")) return null;
    return `${u.protocol}//${u.host}/`;
  } catch {
    return null;
  }
}
