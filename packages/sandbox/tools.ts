import type { Sandbox } from "e2b";
import { runCommand } from "./index";

// Minimal shape of a tool the agent can call. Matches @repo/ai's AgentTool, but
// declared here so this package has no dependency on @repo/ai.
export interface SandboxTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export interface SandboxToolsOptions {
  // Working directory the agent operates in (the cloned repo).
  workdir: string;
  // Cap on bytes returned by read/run so huge outputs don't blow up context.
  maxOutputChars?: number;
}

function clamp(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…[truncated ${s.length - max} chars]`;
}

// File-edit + shell tools the fix agent uses to operate the cloned repo. All
// paths are relative to `workdir`. Returns plain SandboxTool[] — the caller
// (backend) adapts them to @repo/ai's AgentTool (identical shape).
export function sandboxTools(sandbox: Sandbox, opts: SandboxToolsOptions): SandboxTool[] {
  const workdir = opts.workdir;
  const maxOut = opts.maxOutputChars ?? 30_000;

  return [
    {
      name: "list_dir",
      description: "List files and directories under a path (relative to the repo root).",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "Relative path. Use '.' for repo root." } },
        required: ["path"],
      },
      execute: async (args) => {
        const path = String(args.path ?? ".");
        const res = await runCommand(sandbox, `ls -la ${JSON.stringify(path)}`, { cwd: workdir });
        return clamp(res.stdout || res.stderr || "(empty)", maxOut);
      },
    },
    {
      name: "read_file",
      description: "Read a UTF-8 text file (relative to the repo root).",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
      execute: async (args) => {
        const path = String(args.path ?? "");
        try {
          const content = await sandbox.files.read(`${workdir}/${path}`);
          return clamp(typeof content === "string" ? content : String(content), maxOut);
        } catch (err) {
          return `Error reading ${path}: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
    {
      name: "write_file",
      description:
        "Write (create or overwrite) a UTF-8 text file relative to the repo root. Creates parent dirs.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
      execute: async (args) => {
        const path = String(args.path ?? "");
        const content = String(args.content ?? "");
        try {
          await sandbox.files.write(`${workdir}/${path}`, content);
          return `Wrote ${content.length} chars to ${path}`;
        } catch (err) {
          return `Error writing ${path}: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
    {
      name: "run_command",
      description:
        "Run a shell command in the repo root (e.g. 'grep -r foo .', 'bun run build', 'git add -A'). Returns exit code, stdout, stderr.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
          timeoutMs: { type: "number", description: "Optional command timeout in ms." },
        },
        required: ["command"],
      },
      execute: async (args) => {
        const command = String(args.command ?? "");
        const timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : undefined;
        const res = await runCommand(sandbox, command, { cwd: workdir, timeoutMs });
        const body = [
          `exit: ${res.exitCode}`,
          res.stdout ? `stdout:\n${res.stdout}` : "",
          res.stderr ? `stderr:\n${res.stderr}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        return clamp(body, maxOut);
      },
    },
  ];
}
