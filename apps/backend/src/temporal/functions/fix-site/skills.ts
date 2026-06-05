import { readFileSync } from "node:fs";

// Load the agent's system prompt and per-check skill files from @repo/agent.
// We resolve through the package's export map so paths work regardless of where
// the worker runs from.

function resolveAgentFile(subpath: string): string {
  // @repo/agent exports "./prompts/*" and "./skills/*".
  return require.resolve(`@repo/agent/${subpath}`);
}

export function loadSystemPrompt(): string {
  return readFileSync(resolveAgentFile("prompts/geo-fix-agent.md"), "utf8");
}

// The autonomous harness prompt (full sandbox access, one goal).
export function loadHarnessPrompt(): string {
  return readFileSync(resolveAgentFile("prompts/fix-harness.md"), "utf8");
}

// Load a check's skill markdown. Returns null if there is no skill file (then
// the check is treated as flag-only).
export function loadSkill(rubricId: string): string | null {
  try {
    return readFileSync(resolveAgentFile(`skills/${rubricId}.md`), "utf8");
  } catch {
    return null;
  }
}

export function loadRecon(): string {
  return readFileSync(resolveAgentFile("skills/_recon.md"), "utf8");
}
