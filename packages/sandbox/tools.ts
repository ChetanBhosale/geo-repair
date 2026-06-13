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
  // Default timeout for ad-hoc shell commands. Long build/serve validation
  // should use a dedicated caller/tool with explicit timeouts instead.
  defaultCommandTimeoutMs?: number;
  maxCommandTimeoutMs?: number;
}

function clamp(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…[truncated ${s.length - max} chars]`;
}

function commandTimeout(
  args: Record<string, unknown>,
  opts: SandboxToolsOptions,
): number {
  const fallback = opts.defaultCommandTimeoutMs ?? 2 * 60 * 1000;
  const max = opts.maxCommandTimeoutMs ?? 5 * 60 * 1000;
  const requested =
    typeof args.timeoutMs === "number" ? args.timeoutMs : fallback;
  return Math.max(1_000, Math.min(requested, max));
}

function broadRepoWalk(command: string): boolean {
  const normalized = command.trim().replace(/\s+/g, " ");
  if (!/^find\s+\.(\s|$)/.test(normalized)) return false;
  return !/node_modules|\.next|\.git|dist|build/.test(normalized);
}

// File-edit + shell tools the fix agent uses to operate the cloned repo. All
// paths are relative to `workdir`. Returns plain SandboxTool[] — the caller
// (backend) adapts them to @repo/ai's AgentTool (identical shape).
export function sandboxTools(
  sandbox: Sandbox,
  opts: SandboxToolsOptions,
): SandboxTool[] {
  const workdir = opts.workdir;
  const maxOut = opts.maxOutputChars ?? 30_000;

  return [
    {
      name: "list_dir",
      description:
        "List files and directories under a path (relative to the repo root).",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path. Use '.' for repo root.",
          },
        },
        required: ["path"],
      },
      execute: async (args) => {
        const path = String(args.path ?? ".");
        const res = await runCommand(
          sandbox,
          `ls -la ${JSON.stringify(path)}`,
          { cwd: workdir },
        );
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
          return clamp(
            typeof content === "string" ? content : String(content),
            maxOut,
          );
        } catch (err) {
          return `Error reading ${path}: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
    {
      name: "edit_file",
      description:
        "Make a SURGICAL edit to an existing file: replace an exact snippet (old_string) with " +
        "new_string, leaving every other byte of the file unchanged. PREFER THIS over write_file " +
        "for edits — it keeps diffs minimal and avoids reformatting untouched code. old_string " +
        "must match the file EXACTLY (including whitespace and indentation) and must be unique; " +
        "include a few surrounding lines for context if needed. Set replace_all to change every " +
        "occurrence. Use write_file only to create a brand-new file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          old_string: {
            type: "string",
            description:
              "Exact text to find, with enough surrounding context to be unique in the file.",
          },
          new_string: { type: "string", description: "Replacement text." },
          replace_all: {
            type: "boolean",
            description:
              "Replace every occurrence of old_string (default false).",
          },
        },
        required: ["path", "old_string", "new_string"],
      },
      execute: async (args) => {
        const path = String(args.path ?? "");
        const oldStr = String(args.old_string ?? "");
        const newStr = String(args.new_string ?? "");
        const replaceAll = args.replace_all === true;
        if (!oldStr) {
          return "Error: old_string must not be empty. Use write_file to create a new file.";
        }
        if (oldStr === newStr) {
          return "Error: old_string and new_string are identical — nothing to change.";
        }
        try {
          const raw = await sandbox.files.read(`${workdir}/${path}`);
          const content = typeof raw === "string" ? raw : String(raw);
          const count = content.split(oldStr).length - 1;
          if (count === 0) {
            return `Error: old_string not found in ${path}. Read the file and match the exact text, including indentation.`;
          }
          if (count > 1 && !replaceAll) {
            return `Error: old_string appears ${count} times in ${path}. Add surrounding context to make it unique, or set replace_all=true.`;
          }
          // split/join avoids String.replace's special $-pattern handling.
          const updated = content.split(oldStr).join(newStr);
          await sandbox.files.write(`${workdir}/${path}`, updated);
          return `Edited ${path} (${count} replacement${count === 1 ? "" : "s"}).`;
        } catch (err) {
          return `Error editing ${path}: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
    {
      name: "write_file",
      description:
        "Create a new UTF-8 text file (or fully replace one) relative to the repo root. Creates " +
        "parent dirs. For EDITS to an existing file, use edit_file instead — write_file rewrites " +
        "the whole file and bloats the diff with reformatting.",
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
        "Run a bounded diagnostic shell command in the repo root. This is for inspection and short checks; use the dedicated validation tool for build/serve/scan verification. Returns exit code, stdout, stderr.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
          timeoutMs: {
            type: "number",
            description: "Optional command timeout in ms.",
          },
        },
        required: ["command"],
      },
      execute: async (args) => {
        const command = String(args.command ?? "");
        if (broadRepoWalk(command)) {
          return [
            "Error: broad `find .` repo walks are disabled for agent diagnostics because they dump node_modules/build output and derail the turn.",
            "Scope the command to the relevant app/package, for example `find apps/web apps/backend-v2 packages -path '*/node_modules' -prune -o -name '*scrape*' -print`.",
          ].join("\n");
        }
        const timeoutMs = commandTimeout(args, opts);
        const res = await runCommand(sandbox, command, {
          cwd: workdir,
          timeoutMs,
        });
        const body = [
          `exit: ${res.exitCode}`,
          `timeoutMs: ${timeoutMs}`,
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
