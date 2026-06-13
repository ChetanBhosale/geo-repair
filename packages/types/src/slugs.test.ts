import { describe, expect, test } from "bun:test";
import { numberedSlug, projectSlugBase, slugify, uniqueSlug } from "./slugs";

describe("stable dashboard slugs", () => {
  test("normalizes display names", () => {
    expect(slugify("My App / Website")).toBe("my-app-website");
    expect(slugify("   ")).toBe("project");
  });

  test("keeps reserved project routes reachable", () => {
    expect(projectSlugBase("settings")).toBe("settings-project");
    expect(projectSlugBase("My SaaS")).toBe("my-saas");
  });

  test("adds suffixes for collisions", () => {
    expect(uniqueSlug("my-saas", ["my-saas", "my-saas-2"])).toBe("my-saas-3");
  });

  test("creates stable run counters", () => {
    expect(numberedSlug("scan", 0)).toBe("scan-1");
    expect(numberedSlug("fix", 4)).toBe("fix-5");
  });
});
