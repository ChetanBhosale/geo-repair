import { prisma } from "@repo/db";
import { runAgent, type AgentTool } from "@repo/ai";
import {
  createSandbox,
  connectSandbox,
  cloneRepo,
  runCommand,
  killSandbox,
  sandboxTools,
} from "@repo/sandbox";
import Secrets from "@repo/secrets/backend";
import type { FixSiteInput } from "../../shared";
import { checkSite } from "../checkup/crawler";
import { buildFixPlan } from "./fix-plan";
import { resolveGitToken } from "./git-creds";
import { loadHarnessPrompt, loadSkill } from "./skills";
import {
  logEvent,
  setState,
  setSandbox,
  setError,
  refreshCounters,
  setPr,
  addCogs,
} from "./run-store";

const REPO_DIR = "/home/user/repo";

// The harness result the workflow records. Never throws — outcome is data.
export interface HarnessResult {
  ok: boolean;
  committed: boolean;
  prUrl: string | null;
  prNumber: number | null;
  fixedChecks: number;
  totalChecks: number;
  summary: string;
  error: string | null;
}

// ── 1. Scan + plan + sandbox + clone. Records the checks for the UI and gets
//      the repo onto a fix branch in a live sandbox. Returns the failing-check
//      task list for the agent. Best-effort; only true infra errors throw
//      (Temporal will retry those against the same sandbox id). ───────────────
export async function prepareRun(input: FixSiteInput): Promise<{
  sandboxId: string;
  branch: string;
  tasks: {
    rubricId: string;
    category: string;
    scope: string;
    skill: string | null;
  }[];
}> {
  // Fresh authoritative scan -> fix plan.
  await setState(input.fixRunId, "SCANNING");
  await logEvent(input.fixRunId, "scan_started", null, {
    website: input.website,
  });

  const report = await checkSite(input.website);
  const plan = buildFixPlan(report.findings, {
    pagesChecked: report.crawl.pagesChecked,
  });
  const planTasks = [...plan.siteWide, ...plan.perPage];

  // Persist each task as a FixCheck (for the dashboard). The harness updates
  // these from its summary at the end.
  for (const t of planTasks) {
    await prisma.fixCheck.upsert({
      where: {
        fixRunId_rubricId: { fixRunId: input.fixRunId, rubricId: t.rubricId },
      },
      create: {
        fixRunId: input.fixRunId,
        rubricId: t.rubricId,
        category: t.category,
        scope: t.scope,
        tier: t.tier,
        weight: t.weight,
        affectedCount: t.affectedCount,
        status: "PENDING",
      },
      update: {},
    });
  }
  for (const f of plan.flagged) {
    await prisma.fixCheck.upsert({
      where: {
        fixRunId_rubricId: { fixRunId: input.fixRunId, rubricId: f.rubricId },
      },
      create: {
        fixRunId: input.fixRunId,
        rubricId: f.rubricId,
        category: "",
        scope: "per-page",
        tier: "out-of-scope",
        affectedCount: f.affectedCount,
        status: "FLAGGED",
        note: f.reason,
      },
      update: {},
    });
  }
  await refreshCounters(input.fixRunId);
  await logEvent(input.fixRunId, "plan_built", null, {
    siteWide: plan.totals.siteWide,
    perPage: plan.totals.perPage,
    flagged: plan.flagged.length,
  });

  // Sandbox: reconnect to a stored id (crash recovery) or create fresh.
  const run = await prisma.fixRun.findUnique({
    where: { id: input.fixRunId },
    select: { sandboxId: true },
  });
  let sandboxId = run?.sandboxId ?? null;
  if (sandboxId) {
    try {
      const sb = await connectSandbox(sandboxId);
      if (!(await sb.isRunning())) sandboxId = null;
      else
        await logEvent(input.fixRunId, "sandbox_reconnected", null, {
          sandboxId,
        });
    } catch {
      sandboxId = null;
    }
  }
  if (!sandboxId) {
    await setState(input.fixRunId, "CLONING");
    await setSandbox(input.fixRunId, null, "CREATING");
    const sandbox = await createSandbox({ timeoutMs: 30 * 60 * 1000 });
    sandboxId = sandbox.sandboxId;
    await setSandbox(input.fixRunId, sandboxId, "RUNNING");
    await logEvent(input.fixRunId, "sandbox_created", null, { sandboxId });
  }

  const branch = `geo-repair/fix-${input.fixRunId.slice(0, 8)}`;
  const sandbox = await connectSandbox(sandboxId);

  // Clone (idempotent) + branch.
  const cloned = await runCommand(
    sandbox,
    `test -d ${REPO_DIR}/.git && echo yes || echo no`,
  );
  if (cloned.stdout.trim() !== "yes") {
    const token = await resolveGitToken(input.userId);
    const { result } = await cloneRepo(sandbox, {
      cloneUrl: input.cloneUrl,
      branch: input.defaultBranch,
      dir: REPO_DIR,
      token,
    });
    if (result.exitCode !== 0) {
      throw new Error(`git clone failed: ${result.stderr}`); // true infra error -> retry
    }
    await runCommand(sandbox, `git config user.email "bot@geo.repair"`, {
      cwd: REPO_DIR,
    });
    await runCommand(sandbox, `git config user.name "GEO Repair Bot"`, {
      cwd: REPO_DIR,
    });
    await logEvent(input.fixRunId, "repo_cloned", null, { branch });
  }
  await runCommand(sandbox, `git checkout -B ${branch}`, { cwd: REPO_DIR });

  const tasks = planTasks.map((t) => ({
    rubricId: t.rubricId,
    category: t.category,
    scope: t.scope,
    skill: loadSkill(t.rubricId),
  }));

  return { sandboxId, branch, tasks };
}

// ── 2. The harness: ONE autonomous agent with full sandbox access. Explores,
//      fixes the failing checks, commits. Wraps everything so it NEVER throws —
//      whatever happens, it returns a structured result the workflow records. ─
export async function runHarness(
  input: FixSiteInput,
  sandboxId: string,
  tasks: {
    rubricId: string;
    category: string;
    scope: string;
    skill: string | null;
  }[],
): Promise<{ committed: boolean; summary: string }> {
  await setState(input.fixRunId, "FIXING");
  await logEvent(input.fixRunId, "harness_started", null, {
    checks: tasks.map((t) => t.rubricId),
  });

  try {
    const sandbox = await connectSandbox(sandboxId);
    const tools = sandboxTools(sandbox, {
      workdir: REPO_DIR,
    }) as unknown as AgentTool[];

    // Build the goal: the failing checks + their skills (guidance, not a rigid
    // per-check loop). The agent decides how to apply them to THIS repo.
    const checkBlocks = tasks
      .map((t) => {
        const head = `### ${t.rubricId} (${t.category}, ${t.scope})`;
        return t.skill
          ? `${head}\n${t.skill}`
          : `${head}\n(no skill doc — use judgment or flag)`;
      })
      .join("\n\n");

    const system = loadHarnessPrompt();
    const user = [
      `Repository: ${input.repoFullName}`,
      `Live site: ${input.website}`,
      `Default branch: ${input.defaultBranch}`,
      `You are already on the fix branch in a fresh clone at the repo root.`,
      ``,
      `## User clarification intake`,
      `Use these answers as hard scope and preference constraints. If a user did not opt into net-new claims, content, competitor pages, or visual changes, do not create them.`,
      ``,
      intakePromptBlock(input),
      ``,
      `## Failing checks to fix`,
      `Here are the GEO/AEO checks that failed, each with a skill doc describing the pass bar`,
      `and per-framework fixes. Apply them to this project's ACTUAL structure (explore first).`,
      ``,
      checkBlocks,
      ``,
      `Begin by exploring the repo, then fix what you can, then commit with git add -A && git commit.`,
    ].join("\n");

    const result = await runAgent({
      system,
      user,
      tools,
      maxSteps: 80,
      maxTokens: 8000,
      onEvent: async (log) => {
        await logEvent(input.fixRunId, `agent_${log.type}`, null, {
          toolName: log.toolName,
          content: log.content?.slice(0, 800),
          toolArgs: log.toolArgs,
        });
      },
    });

    await addCogs(
      input.fixRunId,
      result.tokensIn,
      result.tokensOut,
      Secrets.LLM_MODEL,
    );

    // Did the agent actually produce a commit on this branch?
    const committedCheck = await runCommand(
      sandbox,
      `git rev-list --count ${input.defaultBranch}..HEAD 2>/dev/null || echo 0`,
      { cwd: REPO_DIR },
    );
    const commitCount = parseInt(committedCheck.stdout.trim() || "0", 10);
    const committed = commitCount > 0;

    if (committed) {
      await logEvent(
        input.fixRunId,
        "diff_summary",
        null,
        await collectDiffSummary(sandbox, input.defaultBranch),
      );
    }

    // Best-effort: reflect the agent's summary onto the FixCheck rows.
    await applySummaryToChecks(
      input.fixRunId,
      result.finalText,
      tasks,
      committed,
    );

    await logEvent(input.fixRunId, "harness_finished", null, {
      committed,
      commitCount,
      stoppedReason: result.stoppedReason,
    });

    return { committed, summary: result.finalText };
  } catch (err) {
    // The agent harness must never crash the run — record and continue.
    const msg = err instanceof Error ? err.message : String(err);
    await logEvent(input.fixRunId, "harness_error", null, { error: msg });
    return { committed: false, summary: `Harness error: ${msg}` };
  }
}

// Mark checks fixed/skipped from the agent's free-text summary (heuristic).
async function applySummaryToChecks(
  fixRunId: string,
  summary: string,
  tasks: { rubricId: string }[],
  committed: boolean,
): Promise<void> {
  const lower = summary.toLowerCase();
  for (const t of tasks) {
    const id = t.rubricId.toLowerCase();
    // If the summary mentions the check under a "fixed" context and we committed,
    // mark it FIXED; otherwise SKIPPED. This is display-only; the PR diff is truth.
    const mentioned = lower.includes(id);
    const fixed =
      committed &&
      mentioned &&
      !/\bskip|already|flag/.test(sliceAround(lower, id));
    await prisma.fixCheck.update({
      where: { fixRunId_rubricId: { fixRunId, rubricId: t.rubricId } },
      data: {
        status: fixed ? "FIXED" : "SKIPPED",
        fixed,
        note: mentioned ? "see PR summary" : "not addressed",
      },
    });
  }
  await refreshCounters(fixRunId);
}

function sliceAround(text: string, needle: string): string {
  const i = text.indexOf(needle);
  if (i < 0) return "";
  return text.slice(Math.max(0, i - 40), i + 80);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

async function collectDiffSummary(
  sandbox: Awaited<ReturnType<typeof connectSandbox>>,
  defaultBranch: string,
): Promise<Record<string, unknown>> {
  const range = shellQuote(`${defaultBranch}..HEAD`);
  const [stat, nameStatus, patch] = await Promise.all([
    runCommand(sandbox, `git diff --stat ${range}`, { cwd: REPO_DIR }),
    runCommand(sandbox, `git diff --name-status ${range}`, { cwd: REPO_DIR }),
    runCommand(
      sandbox,
      `git diff --no-ext-diff --unified=3 ${range} | head -c 24000`,
      {
        cwd: REPO_DIR,
        timeoutMs: 60_000,
      },
    ),
  ]);

  return {
    stat: stat.stdout.slice(0, 8000),
    nameStatus: nameStatus.stdout.slice(0, 8000),
    patch: patch.stdout.slice(0, 24000),
    truncated: patch.stdout.length >= 24000,
  };
}

function intakePromptBlock(input: FixSiteInput): string {
  if (!input.intake?.answers.length) {
    return "No structured clarification intake was submitted.";
  }

  return input.intake.answers
    .map((answer) =>
      [
        `- ${answer.question}`,
        `  Answer: ${answer.answerLabel}`,
        answer.notes ? `  Notes: ${answer.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
}

// GitHub REST helpers for opening the PR with a fork fallback. A token that can
// write the base repo (the owner's OAuth token) opens the PR directly; a token
// that can't (a service account) forks, pushes to the fork, and opens a
// cross-fork PR. Cross-fork PRs into a public base need a classic token with
// `public_repo`/`repo` scope; a fine-grained PAT scoped to other repos can't.
function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "geo-repair",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function githubLogin(token: string): Promise<string> {
  const res = await fetch("https://api.github.com/user", {
    headers: ghHeaders(token),
  });
  const j = (await res.json()) as { login?: string };
  if (!res.ok || !j.login)
    throw new Error(`github whoami failed: ${res.status}`);
  return j.login;
}

async function ensureFork(
  token: string,
  repoFullName: string,
  login: string,
): Promise<string> {
  const repoName = repoFullName.split("/")[1] ?? repoFullName;
  const forkFull = `${login}/${repoName}`;
  const existing = await fetch(`https://api.github.com/repos/${forkFull}`, {
    headers: ghHeaders(token),
  });
  if (existing.ok) return forkFull;
  await fetch(`https://api.github.com/repos/${repoFullName}/forks`, {
    method: "POST",
    headers: ghHeaders(token),
    body: "{}",
  });
  // Forking is async; poll until the fork is queryable (max ~30s).
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const check = await fetch(`https://api.github.com/repos/${forkFull}`, {
      headers: ghHeaders(token),
    });
    if (check.ok) return forkFull;
  }
  throw new Error("fork did not become ready in time");
}

async function createPr(
  token: string,
  repoFullName: string,
  payload: {
    head: string;
    base: string;
    title: string;
    body: string;
    maintainer_can_modify?: boolean;
  },
): Promise<{
  ok: boolean;
  htmlUrl?: string;
  number?: number;
  message?: string;
  status: number;
}> {
  const res = await fetch(
    `https://api.github.com/repos/${repoFullName}/pulls`,
    {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify(payload),
    },
  );
  const j = (await res.json()) as {
    number?: number;
    html_url?: string;
    message?: string;
  };
  return {
    ok: res.ok && !!j.html_url && !!j.number,
    htmlUrl: j.html_url,
    number: j.number,
    message: j.message,
    status: res.status,
  };
}

async function pushAndOpenPr(opts: {
  sandbox: Awaited<ReturnType<typeof connectSandbox>>;
  token: string;
  repoFullName: string;
  cloneUrl: string;
  branch: string;
  defaultBranch: string;
  title: string;
  body: string;
  onEvent: (type: string, payload: Record<string, unknown>) => Promise<void>;
}): Promise<{ prUrl: string; prNumber: number; viaFork: boolean }> {
  const {
    sandbox,
    token,
    repoFullName,
    branch,
    defaultBranch,
    title,
    body,
    onEvent,
  } = opts;
  const baseAuthUrl = opts.cloneUrl.replace(
    "https://",
    `https://x-access-token:${token}@`,
  );

  // 1. Direct path: push to the base repo and open a same-repo PR.
  const directPush = await runCommand(
    sandbox,
    `git push ${baseAuthUrl} ${branch} --force`,
    {
      cwd: REPO_DIR,
      timeoutMs: 5 * 60 * 1000,
    },
  );
  if (directPush.exitCode === 0) {
    await onEvent("branch_pushed", { branch, target: "base" });
    const pr = await createPr(token, repoFullName, {
      head: branch,
      base: defaultBranch,
      title,
      body,
    });
    if (pr.ok)
      return { prUrl: pr.htmlUrl!, prNumber: pr.number!, viaFork: false };
    await onEvent("direct_pr_failed", {
      status: pr.status,
      message: pr.message ?? null,
    });
    // Branch is on the base but the PR was refused — fall through to the fork path.
  } else {
    await onEvent("direct_push_failed", {
      detail: directPush.stderr.slice(-300),
    });
  }

  // 2. Fork path: fork into the token account, push there, open a cross-fork PR.
  const login = await githubLogin(token);
  const forkFull = await ensureFork(token, repoFullName, login);
  await onEvent("fork_ready", { fork: forkFull });
  const forkUrl = `https://x-access-token:${token}@github.com/${forkFull}.git`;
  const forkPush = await runCommand(
    sandbox,
    `git push ${forkUrl} ${branch} --force`,
    {
      cwd: REPO_DIR,
      timeoutMs: 5 * 60 * 1000,
    },
  );
  if (forkPush.exitCode !== 0) {
    throw new Error(`push to fork failed: ${forkPush.stderr.slice(-400)}`);
  }
  await onEvent("branch_pushed", { branch, target: "fork" });
  const pr = await createPr(token, repoFullName, {
    head: `${login}:${branch}`,
    base: defaultBranch,
    title,
    body,
    maintainer_can_modify: true,
  });
  if (!pr.ok) {
    throw new Error(`open cross-fork PR failed: ${pr.message ?? pr.status}`);
  }
  return { prUrl: pr.htmlUrl!, prNumber: pr.number!, viaFork: true };
}

// ── 3. Finalize: push the branch + open the PR if there's a commit. Records the
//      outcome. NEVER throws — a push/PR failure becomes a recorded error, not a
//      workflow crash. ─────────────────────────────────────────────────────────
export async function finalizeRun(
  input: FixSiteInput,
  sandboxId: string,
  committed: boolean,
  summary: string,
): Promise<HarnessResult> {
  const counts = await prisma.fixCheck.findMany({
    where: { fixRunId: input.fixRunId },
    select: { rubricId: true, status: true, fixed: true, note: true },
  });
  const fixedChecks = counts.filter((c) => c.fixed).length;
  const totalChecks = counts.length;

  if (!committed) {
    await prisma.fixRun.update({
      where: { id: input.fixRunId },
      data: { state: "COMPLETED" },
    });
    await logEvent(input.fixRunId, "no_changes", null, {
      summary: summary.slice(0, 500),
    });
    return {
      ok: true,
      committed: false,
      prUrl: null,
      prNumber: null,
      fixedChecks,
      totalChecks,
      summary,
      error: null,
    };
  }

  try {
    await setState(input.fixRunId, "PUSHING");
    const sandbox = await connectSandbox(sandboxId);
    const token = await resolveGitToken(input.userId);
    const branch = `geo-repair/fix-${input.fixRunId.slice(0, 8)}`;

    const fixed = counts.filter((c) => c.fixed);
    const flagged = counts.filter((c) => c.status === "FLAGGED");
    const body = [
      "## GEO Repair — automated fixes",
      "",
      summary,
      "",
      "### Checks",
      ...(fixed.length
        ? fixed.map((c) => `- fixed: \`${c.rubricId}\``)
        : ["- (see summary)"]),
      ...flagged.map((c) => `- flagged: \`${c.rubricId}\` ${c.note ?? ""}`),
      "",
      "These changes improve technical GEO/AEO readiness. They do not guarantee traffic, rankings, or AI citations.",
    ].join("\n");

    const { prUrl, prNumber, viaFork } = await pushAndOpenPr({
      sandbox,
      token,
      repoFullName: input.repoFullName,
      cloneUrl: input.cloneUrl,
      branch,
      defaultBranch: input.defaultBranch,
      title: "GEO Repair: AI search readiness fixes",
      body,
      onEvent: (type, payload) => logEvent(input.fixRunId, type, null, payload),
    });

    await setPr(input.fixRunId, branch, prUrl, prNumber);
    await logEvent(input.fixRunId, "pr_strategy", null, { viaFork });
    return {
      ok: true,
      committed: true,
      prUrl,
      prNumber,
      fixedChecks,
      totalChecks,
      summary,
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setError(input.fixRunId, msg);
    return {
      ok: false,
      committed: true,
      prUrl: null,
      prNumber: null,
      fixedChecks,
      totalChecks,
      summary,
      error: msg,
    };
  }
}

// ── 4. Teardown. Always called; never throws. ───────────────────────────────
export async function teardownSandbox(
  input: FixSiteInput,
  sandboxId: string,
): Promise<void> {
  try {
    const sandbox = await connectSandbox(sandboxId);
    await killSandbox(sandbox);
  } catch {
    // already gone
  }
  await setSandbox(input.fixRunId, sandboxId, "KILLED");
  await logEvent(input.fixRunId, "sandbox_killed", null, { sandboxId });
}
