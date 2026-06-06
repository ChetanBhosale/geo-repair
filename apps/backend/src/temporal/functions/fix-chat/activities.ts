import { runAgent, type AgentStepLog, type AgentTool } from "@repo/ai";
import {
  createSandbox,
  connectSandbox,
  cloneRepo,
  runCommand,
  killSandbox,
  sandboxTools,
} from "@repo/sandbox";
import Secrets from "@repo/secrets/backend";
import type { FixChatInput } from "../../shared";
import { resolveGitToken } from "../fix-site/git-creds";
import { loadHarnessPrompt } from "../fix-site/skills";
import { githubLogin, pushFixBranch } from "../fix-site/activities";
import {
  logEvent,
  setState,
  setSandbox,
  addCogs,
  recordSandboxCogs,
} from "../fix-site/run-store";

const REPO_DIR = "/home/user/repo";

async function headSha(
  sandbox: Awaited<ReturnType<typeof connectSandbox>>,
): Promise<string> {
  const res = await runCommand(sandbox, `git rev-parse HEAD`, { cwd: REPO_DIR });
  return res.stdout.trim();
}

// 1. Fresh sandbox on the run's EXISTING fix branch (the run's own sandbox was
//    torn down when the PR opened). Clones the base, then fetches and checks out
//    the PR branch from wherever it lives (base repo, or the fork for a
//    cross-fork PR).
export async function prepareChatSandbox(
  input: FixChatInput,
): Promise<{ sandboxId: string }> {
  await setState(input.fixRunId, "CHATTING");
  await setSandbox(input.fixRunId, null, "CREATING");
  const sandbox = await createSandbox({ timeoutMs: 30 * 60 * 1000 });
  const sandboxId = sandbox.sandboxId;
  await setSandbox(input.fixRunId, sandboxId, "RUNNING");
  await logEvent(input.fixRunId, "sandbox_created", null, { sandboxId });

  const token = await resolveGitToken(input.userId);
  const { result } = await cloneRepo(sandbox, {
    cloneUrl: input.cloneUrl,
    branch: input.defaultBranch,
    dir: REPO_DIR,
    token,
  });
  if (result.exitCode !== 0) {
    throw new Error(`git clone failed: ${result.stderr}`);
  }
  await runCommand(sandbox, `git config user.email "bot@geo.repair"`, {
    cwd: REPO_DIR,
  });
  await runCommand(sandbox, `git config user.name "GEO Repair Bot"`, {
    cwd: REPO_DIR,
  });

  const branchSource = input.prViaFork
    ? await forkRemoteUrl(token, input.repoFullName)
    : input.cloneUrl.replace("https://", `https://x-access-token:${token}@`);
  const fetched = await runCommand(
    sandbox,
    `git fetch ${branchSource} ${input.branch}`,
    { cwd: REPO_DIR, timeoutMs: 5 * 60 * 1000 },
  );
  if (fetched.exitCode !== 0) {
    throw new Error(`failed to fetch fix branch: ${fetched.stderr.slice(-300)}`);
  }
  await runCommand(sandbox, `git checkout -B ${input.branch} FETCH_HEAD`, {
    cwd: REPO_DIR,
  });
  await logEvent(input.fixRunId, "repo_cloned", null, { branch: input.branch });

  return { sandboxId };
}

async function forkRemoteUrl(
  token: string,
  repoFullName: string,
): Promise<string> {
  const login = await githubLogin(token);
  const repoName = repoFullName.split("/")[1] ?? repoFullName;
  return `https://x-access-token:${token}@github.com/${login}/${repoName}.git`;
}

// 2. One agent pass that applies the user's follow-up to the branch and commits.
//    Never throws — the outcome is data the workflow records.
export async function runChatTurn(
  input: FixChatInput,
  sandboxId: string,
): Promise<{ committed: boolean; summary: string }> {
  await logEvent(input.fixRunId, "chat_turn_started", null, {
    content: input.content.slice(0, 2000),
  });

  try {
    const sandbox = await connectSandbox(sandboxId);
    const tools = sandboxTools(sandbox, {
      workdir: REPO_DIR,
    }) as unknown as AgentTool[];

    const before = await headSha(sandbox);
    const system = loadHarnessPrompt();
    const user = [
      `Repository: ${input.repoFullName}`,
      `Live site: ${input.website}`,
      `You are on the existing fix branch "${input.branch}" in a fresh clone. This`,
      `branch already holds your earlier GEO/AEO fixes and has an open pull request.`,
      ``,
      `The user sent a follow-up request about that PR:`,
      `---`,
      input.content.slice(0, 4000),
      `---`,
      ``,
      `Apply ONLY what the user asked for, as a minimal change on this branch. Explore`,
      `first, make the smallest correct edits, keep the build/typecheck passing, then`,
      `commit with git add -A && git commit. If the request is unclear, out of scope,`,
      `or unsafe, make no changes and briefly explain why in your final message.`,
    ].join("\n");

    const onEvent = async (log: AgentStepLog) => {
      await logEvent(input.fixRunId, `agent_${log.type}`, null, {
        toolName: log.toolName,
        content: log.content?.slice(0, log.type === "assistant" ? 8000 : 2000),
        toolArgs: log.toolArgs,
      });
    };

    const result = await runAgent({
      system,
      user,
      tools,
      maxSteps: 50,
      maxTokens: 8000,
      forceFinalAfterSteps: 42,
      keepToolsAfterFinal: true,
      finalInstruction:
        "Finish the requested change now. If you made edits, run `git add -A && git commit`, then stop.",
      onEvent,
    });

    await addCogs(
      input.fixRunId,
      result.tokensIn,
      result.tokensOut,
      Secrets.LLM_MODEL,
    );

    // Safety net: never drop work — commit anything left in the tree.
    const dirty = await runCommand(sandbox, `git status --porcelain`, {
      cwd: REPO_DIR,
    });
    if (dirty.stdout.trim()) {
      await runCommand(
        sandbox,
        `git add -A && git commit -m "fix: follow-up change from chat (auto-saved)"`,
        { cwd: REPO_DIR },
      );
    }

    const after = await headSha(sandbox);
    const committed = after.length > 0 && after !== before;
    await logEvent(input.fixRunId, "chat_turn_finished", null, { committed });

    return { committed, summary: result.finalText || "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logEvent(input.fixRunId, "chat_error", null, { error: msg });
    return { committed: false, summary: `Chat error: ${msg}` };
  }
}

// 3. Push the updated branch (if the agent committed) so the existing PR updates
//    in place. NEVER throws — a push failure is recorded, not fatal.
export async function finalizeChatTurn(
  input: FixChatInput,
  sandboxId: string,
  committed: boolean,
): Promise<void> {
  try {
    if (committed) {
      const sandbox = await connectSandbox(sandboxId);
      const token = await resolveGitToken(input.userId);
      await pushFixBranch({
        sandbox,
        token,
        repoFullName: input.repoFullName,
        cloneUrl: input.cloneUrl,
        branch: input.branch,
        viaFork: input.prViaFork,
      });
      await logEvent(input.fixRunId, "chat_pushed", null, {
        branch: input.branch,
      });
    } else {
      await logEvent(input.fixRunId, "chat_no_changes", null, {});
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logEvent(input.fixRunId, "chat_error", null, { error: msg });
  }
  // The run is already a success; return it to PR_OPENED regardless of outcome.
  await setState(input.fixRunId, "PR_OPENED");
}

// 4. Teardown. Always called; never throws.
export async function teardownChatSandbox(
  input: FixChatInput,
  sandboxId: string,
): Promise<void> {
  try {
    const sandbox = await connectSandbox(sandboxId);
    await killSandbox(sandbox);
  } catch {
    // already gone
  }
  await setSandbox(input.fixRunId, sandboxId, "KILLED");
  const cogs = await recordSandboxCogs(input.fixRunId, sandboxId);
  await logEvent(input.fixRunId, "sandbox_killed", null, {
    sandboxId,
    sandboxSeconds: cogs?.sandboxSeconds ?? null,
  });
}

// Infra failure before/around the turn: record it and return the run to
// PR_OPENED so the user can retry. A failed follow-up never marks the whole run
// FAILED — the original fix still succeeded.
export async function failChat(
  input: FixChatInput,
  error: string,
): Promise<void> {
  await logEvent(input.fixRunId, "chat_error", null, { error });
  await setState(input.fixRunId, "PR_OPENED");
}
