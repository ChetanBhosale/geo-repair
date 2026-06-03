// Tests for the page-selection algorithm: caps big sections, prioritizes key top-level pages,
// always includes the homepage, and reports sections + skipped sample.

import { test, expect } from "bun:test";
import { selectRepresentative } from "./discover.ts";

const HOME = "https://site.com/";

function makeBlog(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `https://site.com/blog/post-${i}`);
}

test("homepage is always first and present", () => {
  const { selected } = selectRepresentative(HOME, ["https://site.com/pricing"], {
    maxPages: 10,
    maxPerSection: 3,
  });
  expect(selected[0]).toBe(HOME);
});

test("a huge blog section is capped, never dominates", () => {
  const candidates = [
    "https://site.com/pricing",
    "https://site.com/features",
    ...makeBlog(500),
  ];
  const { selected, sections } = selectRepresentative(HOME, candidates, {
    maxPages: 10,
    maxPerSection: 3,
  });
  const blogCount = selected.filter((u) => u.includes("/blog/")).length;
  expect(blogCount).toBeLessThanOrEqual(3);
  expect(sections["/blog"]).toBe(500); // we still report the true count
  expect(selected).toContain("https://site.com/pricing");
  expect(selected).toContain("https://site.com/features");
});

test("priority slugs (pricing/features) win over alphabetical top-level pages", () => {
  const candidates = [
    "https://site.com/zebra",
    "https://site.com/about",
    "https://site.com/pricing",
    "https://site.com/aardvark",
    "https://site.com/features",
  ];
  const { selected } = selectRepresentative(HOME, candidates, { maxPages: 3, maxPerSection: 3 });
  // homepage + 2 more; pricing & features must be the two chosen, not the alphabetical aardvark.
  expect(selected).toContain("https://site.com/pricing");
  expect(selected).toContain("https://site.com/features");
  expect(selected).not.toContain("https://site.com/aardvark");
});

test("never exceeds maxPages and dedupes", () => {
  const candidates = [...makeBlog(50), "https://site.com/pricing", "https://site.com/pricing"];
  const { selected } = selectRepresentative(HOME, candidates, { maxPages: 5, maxPerSection: 2 });
  expect(selected.length).toBeLessThanOrEqual(5);
  expect(new Set(selected).size).toBe(selected.length); // no duplicates
});

test("asset-like URLs are filtered out", () => {
  const candidates = [
    "https://site.com/image.png",
    "https://site.com/styles.css",
    "https://site.com/pricing",
  ];
  const { selected } = selectRepresentative(HOME, candidates, { maxPages: 10, maxPerSection: 3 });
  expect(selected.some((u) => u.endsWith(".png") || u.endsWith(".css"))).toBe(false);
  expect(selected).toContain("https://site.com/pricing");
});
