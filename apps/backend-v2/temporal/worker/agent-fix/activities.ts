import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import {
  connectSandbox,
  createSandbox,
  cloneRepo,
  killSandbox,
  runCommand,
  sandboxTools,
} from "@repo/sandbox";
import { runAgent, DEFAULT_MODEL, imageTool, type AgentTool, type AgentStepLog } from "@repo/ai";
import type {
  AgentFixWorkflowInput,
  FixCheckInput,
  FixSetup,
} from "./workflow-types";

interface LogRef {
  agentRunId: string;
  projectId: string;
  userId: string;
}

type Source = "AGENT" | "AGENT_FILE";

async function writeLog(
  ref: LogRef,
  source: Source,
  level: "INFO" | "WARN" | "ERROR",
  event: string,
  message: string,
  data?: Prisma.InputJsonValue,
) {
  await prisma.log
    .create({
      data: {
        source,
        level,
        event,
        message,
        data,
        agentRunId: ref.agentRunId,
        projectId: ref.projectId,
        userId: ref.userId,
      },
    })
    .catch(() => {});
}

function refOf(input: AgentFixWorkflowInput): LogRef {
  return { agentRunId: input.agentRunId, projectId: input.projectId, userId: input.userId };
}

// 1. Create the sandbox, clone the repo, and resolve which checks to fix.
export async function fixSetupActivity(input: AgentFixWorkflowInput): Promise<FixSetup> {
  const ref = refOf(input);
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, userId: input.userId },
    include: { account: { select: { accessToken: true } } },
  });
  if (!project) throw new Error("Project not found for fix run.");

  await prisma.agentRun.update({
    where: { id: input.agentRunId },
    data: { status: "FIXING", startedAt: new Date() },
  });

  await writeLog(ref, "AGENT", "INFO", "sandbox_creating", "Spinning up a sandbox to apply the fixes...");
  const sandbox = await createSandbox();
  await prisma.agentRun.update({
    where: { id: input.agentRunId },
    data: { sandboxId: sandbox.sandboxId, sandboxStatus: "RUNNING" },
  });
  await writeLog(ref, "AGENT", "INFO", "sandbox_started", `Sandbox ready (${sandbox.sandboxId}).`);

  await writeLog(ref, "AGENT", "INFO", "cloning_repo", `Cloning ${project.fullName} (${project.defaultBranch})...`);
  const { dir, result } = await cloneRepo(sandbox, {
    cloneUrl: project.cloneUrl,
    branch: project.defaultBranch,
    token: project.account?.accessToken ?? undefined,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Clone failed: ${result.stderr.slice(0, 300)}`);
  }
  await writeLog(ref, "AGENT", "INFO", "repo_cloned", "Repository cloned. Starting the fixes...");

  // Checks to act on: AUTO, or NEEDS_INPUT the user APPROVED. Mark declined ones.
  const rows = await prisma.agentPlanCheck.findMany({
    where: { agentPlanId: input.agentPlanId },
    orderBy: { seq: "asc" },
  });

  const toFix: FixCheckInput[] = [];
  for (const c of rows) {
    const approved = c.mode === "AUTO" || c.choice === "APPROVED";
    if (!approved) {
      await prisma.agentPlanCheck.update({
        where: { id: c.id },
        data: { outcome: c.choice === "DECLINED" ? "SKIPPED_BY_USER" : "PENDING" },
      });
      continue;
    }
    toFix.push({
      id: c.id,
      rubricId: c.rubricId,
      category: c.category,
      approach: c.approach,
      recommendation: c.recommendation,
      evidence: c.evidence,
      targetPages: (c.targetPages as unknown as FixCheckInput["targetPages"]) ?? [],
      userSuggestion: c.userSuggestion,
    });
  }

  return { sandboxId: sandbox.sandboxId, workdir: dir, checks: toFix };
}

function fixSystemPrompt(): string {
  return `You are the GEO Repair fix agent, working headless in a sandbox on a fresh clone of the user's website repo. You are fixing ONE rubric check to push the site's GEO/AEO/SEO readiness toward a full pass.

Tools: list_dir, read_file, edit_file (surgical edits — preferred), write_file (new files only), run_command (grep/build/etc).

Rules:
- Think out loud: one short, jargon-free sentence before a tool call (streams live to the user).
- Make the SMALLEST edits that satisfy this check. Match the file's existing style exactly. Change only what's needed.
- Use only facts already on the site or provided by the user. Never invent claims, pricing, stats, FAQ answers, definitions, or sources.
- Do NOT commit or use git — the harness opens the PR after all checks are done.
- Preserve rendered output; adding meta/JSON-LD/alt/robots/sitemap/llms.txt is safe. Do not rewrite human copy.
- For AEO-delivery checks (markdown-twin, content-negotiation, ai-delivery-headers): hand-write framework-idiomatic code (a markdown route/handler, middleware that serves the twin to AI clients on Accept: text/markdown or a known AI-bot User-Agent, and the response headers X-Robots-Tag: noindex / Vary: Accept / X-Markdown-Tokens / Link rel="alternate"). Build the twin from the page's OWN content source, never paraphrase. NEVER add a third-party dependency (no @dualmark/* or similar) to the user's repo for this.
- If you genuinely cannot fix it safely, say so and make no edits.
When done, end with one short sentence: what you changed (or that nothing was needed).`;
}

function fixUserPrompt(check: FixCheckInput): string {
  return [
    `Fix this check: ${check.rubricId} (${check.category})`,
    check.approach ? `Approach: ${check.approach}` : "",
    check.recommendation ? `Recommendation: ${check.recommendation}` : "",
    check.evidence ? `Evidence: ${check.evidence}` : "",
    check.userSuggestion ? `User note: ${check.userSuggestion}` : "",
    check.targetPages.length ? `Target pages/files:\n${JSON.stringify(check.targetPages, null, 2)}` : "",
    ``,
    `Make the change, then summarize what you did.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// 2. Fix ONE check (its own activity). Edits stream to the code panel; the
// agent's narration streams to the chat.
export async function fixCheckActivity(args: {
  input: AgentFixWorkflowInput;
  sandboxId: string;
  workdir: string;
  check: FixCheckInput;
}): Promise<void> {
  const { input, sandboxId, workdir, check } = args;
  const ref = refOf(input);

  await writeLog(ref, "AGENT", "INFO", "fix_check_started", `Fixing ${check.rubricId}...`);

  if (!process.env.OPEN_ROUTER_KEY) {
    await prisma.agentPlanCheck.update({
      where: { id: check.id },
      data: { outcome: "FAILED", reason: "No model configured." },
    });
    await writeLog(ref, "AGENT", "WARN", "fix_skipped", `Skipped ${check.rubricId}: no model configured.`);
    return;
  }

  const sandbox = await connectSandbox(sandboxId);
  const tools = sandboxTools(sandbox, { workdir }) as AgentTool[];

  // Let the agent generate images (e.g. an OG/social image) via OpenRouter
  // (same key). The image is written straight into the cloned repo.
  if (process.env.OPEN_ROUTER_KEY) {
    tools.push(
      imageTool({
        onImage: async (image, a) => {
          const rel = a.path ?? "public/og.png";
          try {
            await sandbox.files.write(`${workdir}/${rel}`, new Blob([Buffer.from(image.base64, "base64")]));
          } catch (e) {
            return `Generated the image but could not write ${rel}: ${e instanceof Error ? e.message : String(e)}`;
          }
          await writeLog(ref, "AGENT_FILE", "INFO", "file_change", `Generated image ${rel}`, {
            path: rel,
            action: "create",
            rubricId: check.rubricId,
          });
          return `Saved a generated ${image.mimeType} image to ${rel}.`;
        },
      }),
    );
  }

  const onEvent = async (e: AgentStepLog) => {
    if (e.type === "assistant" && e.content?.trim()) {
      await writeLog(ref, "AGENT", "INFO", "agent_message", e.content.trim());
    } else if (e.type === "tool_call") {
      const a = e.toolArgs ?? {};
      if (e.toolName === "edit_file" || e.toolName === "write_file") {
        await writeLog(
          ref,
          "AGENT_FILE",
          "INFO",
          "file_change",
          `${e.toolName === "write_file" ? "Created" : "Edited"} ${String(a.path ?? "")}`,
          { path: String(a.path ?? ""), action: e.toolName === "write_file" ? "create" : "modify", rubricId: check.rubricId },
        );
      } else if (e.toolName === "run_command") {
        await writeLog(ref, "AGENT_FILE", "INFO", "command", `$ ${String(a.command ?? "")}`, { rubricId: check.rubricId });
      } else if (e.toolName === "read_file") {
        await writeLog(ref, "AGENT_FILE", "INFO", "read", `Reading ${String(a.path ?? "")}`);
      }
    }
  };

  try {
    const res = await runAgent({
      system: fixSystemPrompt(),
      user: fixUserPrompt(check),
      tools,
      maxSteps: 20,
      forceFinalAfterSteps: 16,
      keepToolsAfterFinal: false,
      finalInstruction: "Stop editing and summarize what you changed in one sentence.",
      temperature: 0,
      onEvent,
    });

    await prisma.agentPlanCheck.update({
      where: { id: check.id },
      data: { outcome: "FIXED", reason: res.finalText.slice(0, 500) },
    });
    await prisma.agentRun
      .update({
        where: { id: input.agentRunId },
        data: { tokensIn: { increment: res.tokensIn }, tokensOut: { increment: res.tokensOut }, model: DEFAULT_MODEL },
      })
      .catch(() => {});
    await writeLog(ref, "AGENT", "INFO", "fix_check_done", `${check.rubricId}: ${res.finalText.slice(0, 200)}`);
  } catch (err) {
    await prisma.agentPlanCheck.update({
      where: { id: check.id },
      data: { outcome: "FAILED", reason: err instanceof Error ? err.message : String(err) },
    });
    await writeLog(ref, "AGENT", "WARN", "fix_check_failed", `Could not fix ${check.rubricId}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// 3. Verify the build / type-check after all edits (best-effort).
export async function fixVerifyActivity(args: {
  input: AgentFixWorkflowInput;
  sandboxId: string;
  workdir: string;
}): Promise<void> {
  const { input, sandboxId, workdir } = args;
  const ref = refOf(input);
  await prisma.agentRun.update({ where: { id: input.agentRunId }, data: { status: "VERIFYING" } }).catch(() => {});

  const sandbox = await connectSandbox(sandboxId);
  const pkg = await runCommand(sandbox, "test -f package.json && cat package.json || echo NO_PKG", { cwd: workdir });
  if (pkg.stdout.includes("NO_PKG")) {
    await writeLog(ref, "AGENT_FILE", "INFO", "verify", "No package.json — static site, skipping build.");
    return;
  }
  // Pick a build command from common scripts.
  const hasBuild = /"build"\s*:/.test(pkg.stdout);
  if (!hasBuild) {
    await writeLog(ref, "AGENT_FILE", "INFO", "verify", "No build script found, skipping build verification.");
    return;
  }
  await writeLog(ref, "AGENT_FILE", "INFO", "command", "$ (install) && build");
  await runCommand(sandbox, "bun install || npm install --no-audit --no-fund", { cwd: workdir, timeoutMs: 5 * 60 * 1000 });
  const build = await runCommand(sandbox, "bun run build || npm run build", { cwd: workdir, timeoutMs: 8 * 60 * 1000 });
  if (build.exitCode === 0) {
    await writeLog(ref, "AGENT_FILE", "INFO", "verify", "Build passed.");
  } else {
    await writeLog(ref, "AGENT_FILE", "WARN", "verify_failed", `Build failed:\n${build.stderr.slice(0, 800)}`);
  }
}

// 4. Commit on a new branch, push, and open the PR. Save the PR details.
export async function fixOpenPrActivity(args: {
  input: AgentFixWorkflowInput;
  sandboxId: string;
  workdir: string;
}): Promise<void> {
  const { input, sandboxId, workdir } = args;
  const ref = refOf(input);

  const project = await prisma.project.findFirst({
    where: { id: input.projectId, userId: input.userId },
    include: { account: { select: { accessToken: true } } },
  });
  if (!project) throw new Error("Project not found while opening PR.");
  const token = project.account?.accessToken;

  const sandbox = await connectSandbox(sandboxId);

  // Any changes to commit?
  const status = await runCommand(sandbox, "git status --porcelain", { cwd: workdir });
  if (!status.stdout.trim()) {
    await prisma.agentRun.update({
      where: { id: input.agentRunId },
      data: { status: "COMPLETED", finishedAt: new Date() },
    });
    await writeLog(ref, "AGENT", "INFO", "no_changes", "Nothing needed changing — no PR opened.");
    return;
  }

  await prisma.agentRun.update({ where: { id: input.agentRunId }, data: { status: "OPENING_PR" } }).catch(() => {});

  const branch = `geo-repair/fix-${input.agentRunId.slice(-8)}`;
  await runCommand(sandbox, `git config user.email "agent@geo.repair" && git config user.name "GEO Repair Agent"`, { cwd: workdir });
  await runCommand(sandbox, `git checkout -b ${branch}`, { cwd: workdir });
  await runCommand(sandbox, `git add -A`, { cwd: workdir });
  await runCommand(sandbox, `git commit -m "fix: improve AI search readiness (GEO/AEO/SEO)"`, { cwd: workdir });

  if (token) {
    await runCommand(
      sandbox,
      `git remote set-url origin https://x-access-token:${token}@github.com/${project.owner}/${project.name}.git`,
      { cwd: workdir },
    );
  }
  await writeLog(ref, "AGENT_FILE", "INFO", "command", `$ git push origin ${branch}`);
  const push = await runCommand(sandbox, `git push -u origin ${branch}`, { cwd: workdir, timeoutMs: 3 * 60 * 1000 });
  if (push.exitCode !== 0) {
    throw new Error(`Push failed: ${push.stderr.slice(0, 300)}`);
  }

  // Open the PR via the GitHub REST API.
  const fixed = await prisma.agentPlanCheck.count({ where: { agentPlanId: input.agentPlanId, outcome: "FIXED" } });
  const body = `Automated GEO/AEO/SEO readiness fixes by GEO Repair.\n\nThis PR applies ${fixed} fix(es) approved in your plan. Changes improve technical AI-search readiness only.`;
  const prRes = await fetch(`https://api.github.com/repos/${project.owner}/${project.name}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "geo-repair",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title: "GEO Repair: improve AI search readiness",
      head: branch,
      base: project.defaultBranch,
      body,
    }),
  });

  const pr = (await prRes.json().catch(() => ({}))) as { html_url?: string; number?: number; message?: string };
  if (!prRes.ok || !pr.html_url) {
    throw new Error(`PR creation failed: ${pr.message ?? prRes.status}`);
  }

  await prisma.agentRun.update({
    where: { id: input.agentRunId },
    data: {
      status: "PR_OPENED",
      branch,
      prUrl: pr.html_url,
      prNumber: pr.number ?? null,
      prState: "OPEN",
      prOpenedAt: new Date(),
      fixedChecks: fixed,
      finishedAt: new Date(),
    },
  });
  await writeLog(ref, "AGENT", "INFO", "pr_opened", `Opened a pull request: ${pr.html_url}`, { prUrl: pr.html_url, branch });
}

// 5. Tear down the sandbox and clear its id (always runs).
export async function fixTeardownActivity(input: AgentFixWorkflowInput): Promise<void> {
  const run = await prisma.agentRun.findUnique({
    where: { id: input.agentRunId },
    select: { sandboxId: true },
  });
  if (run?.sandboxId) {
    try {
      const sandbox = await connectSandbox(run.sandboxId);
      await killSandbox(sandbox);
    } catch {
      /* already gone */
    }
  }
  await prisma.agentRun
    .update({ where: { id: input.agentRunId }, data: { sandboxId: null, sandboxStatus: "KILLED" } })
    .catch(() => {});
}

export async function failFixActivity(input: AgentFixWorkflowInput, message: string): Promise<void> {
  const ref = refOf(input);
  await prisma.agentRun
    .update({ where: { id: input.agentRunId }, data: { status: "FAILED", error: message, finishedAt: new Date() } })
    .catch(() => {});
  await prisma.workerStatus
    .updateMany({
      where: { temporalWorkflowId: `agent-fix-${input.agentRunId}` },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    })
    .catch(() => {});
  await writeLog(ref, "AGENT", "ERROR", "fix_failed", message);
}

export async function fixCompleteActivity(input: AgentFixWorkflowInput): Promise<void> {
  await prisma.workerStatus
    .updateMany({
      where: { temporalWorkflowId: `agent-fix-${input.agentRunId}` },
      data: { status: "COMPLETED", finishedAt: new Date() },
    })
    .catch(() => {});
}
