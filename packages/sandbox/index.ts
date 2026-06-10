import { Sandbox } from "e2b";
import Secrets from "@repo/secrets/backend";
import { FIX_TEMPLATE_ALIAS } from "./template";

export { Sandbox };
export {
  FIX_TEMPLATE_ALIAS,
  fixTemplate,
  buildFixTemplate,
} from "./template";
export { sandboxTools, type SandboxTool, type SandboxToolsOptions } from "./tools";

// Default per-run lifetime. E2B kills the sandbox after this unless extended.
const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000;

function apiKey(): string {
  if (!Secrets.E2B_SANDBOX_API_KEY) {
    throw new Error("E2B_SANDBOX_API_KEY is not set");
  }
  return Secrets.E2B_SANDBOX_API_KEY;
}

export interface CreateSandboxOptions {
  // E2B template name/id. Defaults to our fix template (git + node + bun).
  // Pass `null` to use E2B's plain base image instead.
  template?: string | null;
  // Auto-kill after this many ms. Defaults to 10 minutes.
  timeoutMs?: number;
}

// Create a fresh ephemeral sandbox (one microVM per run). Defaults to our
// fix template (git + node + bun preinstalled); pass `template` to override,
// or `template: null` for E2B's base image.
export async function createSandbox(opts: CreateSandboxOptions = {}): Promise<Sandbox> {
  const createOpts = { apiKey: apiKey(), timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS };
  const template = opts.template === undefined ? FIX_TEMPLATE_ALIAS : opts.template;
  return template
    ? Sandbox.create(template, createOpts)
    : Sandbox.create(createOpts);
}

// Reconnect to an existing sandbox by id (e.g. across workers/activities).
export async function connectSandbox(sandboxId: string): Promise<Sandbox> {
  return Sandbox.connect(sandboxId, { apiKey: apiKey() });
}

// Hard teardown. Safe to call even if the sandbox is already gone.
export async function killSandbox(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.kill();
  } catch {
    // already killed / unreachable
  }
}

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  // Env vars for this command (e.g. a short-lived token). Not persisted.
  envs?: Record<string, string>;
  timeoutMs?: number;
}

// Run a shell command in the sandbox. NEVER throws on a non-zero exit — E2B's
// commands.run throws CommandExitError on non-zero, so we catch it and return
// the exit code/stdout/stderr. The caller (and the agent) treats failures as
// feedback, not fatal errors. Only a true infra failure (sandbox gone) throws.
export async function runCommand(
  sandbox: Sandbox,
  command: string,
  opts: RunOptions = {}
): Promise<RunResult> {
  try {
    const res = await sandbox.commands.run(command, {
      cwd: opts.cwd,
      envs: opts.envs,
      timeoutMs: opts.timeoutMs,
    });
    return { exitCode: res.exitCode, stdout: res.stdout, stderr: res.stderr };
  } catch (err) {
    // E2B throws CommandExitError on non-zero exit; it carries the result.
    const e = err as {
      exitCode?: number;
      stdout?: string;
      stderr?: string;
      result?: { exitCode?: number; stdout?: string; stderr?: string; error?: string };
      message?: string;
    };
    const r = e.result ?? e;
    if (typeof r.exitCode === "number") {
      return {
        exitCode: r.exitCode,
        stdout: r.stdout ?? "",
        stderr: r.stderr ?? e.message ?? "",
      };
    }
    // Not a command-exit error (e.g. sandbox unreachable) — surface as exit 1.
    return { exitCode: 1, stdout: "", stderr: e.message ?? String(err) };
  }
}

export interface CloneRepoOptions {
  // HTTPS clone URL, e.g. https://github.com/owner/repo.git
  cloneUrl: string;
  // Branch to check out. Defaults to the repo default.
  branch?: string;
  // Directory inside the sandbox to clone into.
  dir?: string;
  // Short-lived token for private repos. Injected only for this command, not
  // persisted in the sandbox or logs.
  token?: string;
}

// Clone a repo into the sandbox and return the directory it was cloned into.
export async function cloneRepo(
  sandbox: Sandbox,
  opts: CloneRepoOptions
): Promise<{ dir: string; result: RunResult }> {
  const dir = opts.dir ?? "/home/user/repo";

  // For private repos, embed the token in the URL just for this command.
  let url = opts.cloneUrl;
  if (opts.token) {
    url = opts.cloneUrl.replace("https://", `https://x-access-token:${opts.token}@`);
  }

  const branchFlag = opts.branch ? `--branch ${opts.branch} ` : "";
  const result = await runCommand(
    sandbox,
    `git clone --depth 1 ${branchFlag}${url} ${dir}`,
    { timeoutMs: 5 * 60 * 1000 }
  );

  return { dir, result };
}

// Run work against a fresh sandbox and ALWAYS tear it down afterwards (success
// or failure). This is the recommended entry point: one microVM per run, hard
// teardown guaranteed.
export async function withSandbox<T>(
  fn: (sandbox: Sandbox) => Promise<T>,
  opts: CreateSandboxOptions = {}
): Promise<T> {
  const sandbox = await createSandbox(opts);
  try {
    return await fn(sandbox);
  } finally {
    await killSandbox(sandbox);
  }
}

// --- Background server (for in-sandbox build verification) -------------------

export interface BackgroundHandle {
  pid: number;
  kill: () => Promise<void>;
}

// Start a long-running command (e.g. a dev/preview server) in the background.
// Returns the pid + a kill fn. Never throws on startup; check the host instead.
export async function startBackground(
  sandbox: Sandbox,
  command: string,
  opts: RunOptions = {}
): Promise<BackgroundHandle> {
  const handle = await sandbox.commands.run(command, {
    background: true,
    cwd: opts.cwd,
    envs: opts.envs,
  });
  return {
    pid: handle.pid,
    kill: async () => {
      try {
        await sandbox.commands.kill(handle.pid);
      } catch {
        /* already gone */
      }
    },
  };
}

// Public host (over HTTPS) to reach a port running inside the sandbox, e.g.
// `https://<getSandboxHost(sandbox, 3000)>`.
export function getSandboxHost(sandbox: Sandbox, port: number): string {
  return sandbox.getHost(port);
}
