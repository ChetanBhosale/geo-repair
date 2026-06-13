export const RESERVED_PROJECT_SLUGS = new Set([
  "account",
  "api",
  "new",
  "projects",
  "purchase",
  "settings",
  "support",
]);

export function slugify(value: string, fallback = "project"): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

export function projectSlugBase(value: string): string {
  const base = slugify(value);
  return RESERVED_PROJECT_SLUGS.has(base) ? `${base}-project` : base;
}

export function uniqueSlug(base: string, existing: Iterable<string>): string {
  const used = new Set(existing);
  if (!used.has(base)) return base;

  let i = 2;
  while (used.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function numberedSlug(prefix: "scan" | "fix", count: number): string {
  return `${prefix}-${Math.max(1, count + 1)}`;
}
