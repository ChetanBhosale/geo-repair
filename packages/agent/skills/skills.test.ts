// Sync test: the per-rubric skill files must stay 1:1 with the canonical fixable checks in
// RUBRIC.md (the single source of truth). No orphan skill, no fixable rubric without a skill.
// Shared skills (filenames starting with "_") are exempt.

import { test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SKILLS_DIR = import.meta.dir;
const RUBRIC = join(SKILLS_DIR, "..", "..", "..", "RUBRIC.md");

/** Parse the "Canonical checks (v1)" table and return ids whose fixable_by_agent is not "false". */
function fixableRubricIds(): string[] {
  const md = readFileSync(RUBRIC, "utf8");
  const start = md.search(/^## Canonical checks \(/m);
  const end = md.indexOf("## Planned expansions", start);
  const section = md.slice(start, end === -1 ? undefined : end);

  const ids: string[] = [];
  for (const line of section.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // table body rows look like: ["", "<n>", "`id`", category, priority, tier, fixable, ""]
    const inner = cells.slice(1, -1);
    if (inner.length < 6) continue;
    if (!/^\d+$/.test(inner[0]!)) continue; // skip header + separator rows
    const idMatch = inner[1]!.match(/`([a-z0-9-]+)`/);
    if (!idMatch) continue;
    const fixable = inner[inner.length - 1]!.toLowerCase();
    if (/^\**false/.test(fixable)) continue; // flag-only checks get no fix skill
    ids.push(idMatch[1]!);
  }
  return ids;
}

/** Skill file ids = non-shared *.md filenames. */
function skillIds(): string[] {
  return readdirSync(SKILLS_DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => f.replace(/\.md$/, ""));
}

test("every fixable rubric has a skill file, and no skill is an orphan", () => {
  const rubric = new Set(fixableRubricIds());
  const skills = new Set(skillIds());

  expect(rubric.size).toBeGreaterThan(20); // sanity: we actually parsed the table

  const missingSkill = [...rubric].filter((id) => !skills.has(id));
  const orphanSkill = [...skills].filter((id) => !rubric.has(id));

  expect(missingSkill).toEqual([]);
  expect(orphanSkill).toEqual([]);
});

test("each non-shared skill's frontmatter id matches its filename", () => {
  for (const id of skillIds()) {
    const body = readFileSync(join(SKILLS_DIR, `${id}.md`), "utf8");
    const fmId = body.match(/^id:\s*(\S+)/m)?.[1];
    expect(fmId).toBe(id);
  }
});
