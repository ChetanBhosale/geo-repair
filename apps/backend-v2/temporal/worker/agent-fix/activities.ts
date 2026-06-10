import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import {
  connectSandbox,
  createSandbox,
  cloneRepo,
  killSandbox,
  runCommand,
  startBackground,
  getSandboxHost,
  sandboxTools,
} from "@repo/sandbox";
import { runAgent, DEFAULT_MODEL, CHEAP_MODEL, imageTool, type AgentTool, type AgentStepLog } from "@repo/ai";
import { runScrape } from "../scraper/run";
import type {
  AgentFixWorkflowInput,
  FixCheckInput,
  FixGroup,
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

// Which batch each check belongs to. Checks that touch the same surface are
// fixed in one agent session so the repo is read once, not per check.
const GROUP_OF: Record<string, string> = {
  // Shared <head> / layout / metadata config.
  "meta-tags": "head",
  "open-graph": "head",
  "canonical-urls": "head",
  "social-image-size": "head",
  "structured-data": "head",
  favicon: "head",
  hreflang: "head",
  charset: "head",
  doctype: "head",
  "mobile-viewport": "head",
  // Site-wide crawl files.
  "robots-ai-crawlers": "crawl",
  sitemap: "crawl",
  "llms-txt": "crawl",
  indexability: "crawl",
  // Page structure / a11y.
  "semantic-html": "semantics",
  "image-alt-text": "semantics",
  "interactive-labels": "semantics",
  "internal-linking": "semantics",
  // Content edits.
  answerability: "content",
  definitions: "content",
  "citation-quality": "content",
  "freshness-eeat": "content",
  // Markdown-twin delivery (routes + middleware + headers).
  "markdown-twin": "aeo-delivery",
  "content-negotiation": "aeo-delivery",
  "ai-delivery-headers": "aeo-delivery",
};

const GROUP_META: Record<string, { label: string; cheap: boolean; order: number }> = {
  crawl: { label: "crawl files (robots, sitemap, llms.txt)", cheap: true, order: 1 },
  head: { label: "metadata & head tags", cheap: true, order: 2 },
  semantics: { label: "semantic HTML & accessibility", cheap: false, order: 3 },
  content: { label: "content (answerability, definitions, citations)", cheap: false, order: 4 },
  "aeo-delivery": { label: "Markdown-twin delivery", cheap: false, order: 5 },
};

// Bucket the approved checks into ordered groups. Unknown ids get their own
// single-check group (still works, just not batched).
function groupChecks(checks: FixCheckInput[]): FixGroup[] {
  const buckets = new Map<string, FixCheckInput[]>();
  for (const c of checks) {
    const key = GROUP_OF[c.rubricId] ?? `single:${c.rubricId}`;
    const arr = buckets.get(key) ?? [];
    arr.push(c);
    buckets.set(key, arr);
  }

  const groups: FixGroup[] = [];
  for (const [key, groupChecks] of buckets) {
    const meta = GROUP_META[key];
    groups.push({
      id: key,
      label: meta?.label ?? groupChecks[0]!.rubricId,
      model: meta?.cheap ? CHEAP_MODEL : DEFAULT_MODEL,
      checks: groupChecks,
    });
  }
  // Stable, sensible order: known groups by their order, singles last.
  groups.sort((a, b) => (GROUP_META[a.id]?.order ?? 99) - (GROUP_META[b.id]?.order ?? 99));
  return groups;
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

  // Reuse the planner's stack summary as fix context (no re-discovery).
  const plan = await prisma.agentPlan.findUnique({
    where: { id: input.agentPlanId },
    select: { summary: true },
  });

  const groups = groupChecks(toFix);
  await writeLog(
    ref,
    "AGENT",
    "INFO",
    "fix_grouped",
    `Planned ${toFix.length} fix(es) in ${groups.length} batch(es): ${groups.map((g) => g.label).join("; ")}.`,
  );

  return {
    sandboxId: sandbox.sandboxId,
    workdir: dir,
    groups,
    checks: toFix,
    repoSummary: plan?.summary ?? "",
  };
}

function fixSystemPrompt(repoSummary: string): string {
  const context = repoSummary
    ? `\n\nWhat the planner already found about this repo (reuse it — do NOT re-explore from scratch):\n${repoSummary}\n`
    : "";
  return `You are the GEO Repair fix agent, working headless in a sandbox on a fresh clone of the user's website repo. You are fixing a BATCH of related rubric checks that touch the same part of the codebase, to push the site's GEO/AEO/SEO readiness toward a full pass.${context}
Tools: list_dir, read_file, edit_file (surgical edits — preferred), write_file (new files only), run_command (grep/build/etc).

Rules:
- Work efficiently: read each shared file ONCE and apply every fix in this batch that touches it. Don't re-read or re-grep files you've already seen.
- Think out loud: one short, jargon-free sentence before a tool call (streams live to the user).
- Make the SMALLEST edits that satisfy these checks. Match the file's existing style exactly. Change only what's needed.
- Use only facts already on the site or provided by the user. Never invent claims, pricing, stats, FAQ answers, definitions, or sources.
- Do NOT commit or use git — the harness opens the PR after all checks are done.
- Preserve rendered output; adding meta/JSON-LD/alt/robots/sitemap/llms.txt is safe. Do not rewrite human copy.
- For AEO-delivery checks (markdown-twin, content-negotiation, ai-delivery-headers): hand-write framework-idiomatic code (a markdown route/handler, middleware that serves the twin to AI clients on Accept: text/markdown or a known AI-bot User-Agent, and the response headers X-Robots-Tag: noindex / Vary: Accept / X-Markdown-Tokens / Link rel="alternate"). Build the twin from the page's OWN content source, never paraphrase. NEVER add a third-party dependency (no @dualmark/* or similar) to the user's repo for this.
- For a net-new page proposal (its id starts with "new-page-"): the user APPROVED creating it. Add it as a new route/file idiomatic to this stack, structured for AI extraction — one clear <h1>, question-style headings, answer-first self-contained sections of ~50-150 words, and a comparison table when the page compares options. Add the right JSON-LD (FAQPage / Article / etc.), link it from the nav + sitemap + /llms.txt, and add its markdown twin. Use ONLY facts already on the site or the details in the user's note. NEVER invent claims, statistics, pricing, or competitor details (if a fact isn't available, leave it out).
- If you genuinely cannot fix one of the checks safely, say so for that check and move on to the others.
When done, end with one short sentence per check: what you changed (or that nothing was needed).`;
}

function fixGroupUserPrompt(group: FixGroup): string {
  const checks = group.checks
    .map((check, i) =>
      [
        `${i + 1}. ${check.rubricId} (${check.category})`,
        check.approach ? `   Approach: ${check.approach}` : "",
        check.recommendation ? `   Recommendation: ${check.recommendation}` : "",
        check.evidence ? `   Evidence: ${check.evidence}` : "",
        check.userSuggestion ? `   User note: ${check.userSuggestion}` : "",
        check.targetPages.length ? `   Target pages/files: ${JSON.stringify(check.targetPages)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
  return [
    `Fix this batch of ${group.checks.length} related check(s) — ${group.label}. They touch the same area, so share your reads and edits across them.`,
    ``,
    checks,
    ``,
    `Apply all the fixes, then summarize what you did for each check.`,
  ].join("\n");
}

// 2. Fix ONE group of related checks (its own activity). Edits stream to the
// code panel; the agent's narration streams to the chat. Batching shares the
// repo reads across the group instead of re-exploring per check.
export async function fixGroupActivity(args: {
  input: AgentFixWorkflowInput;
  sandboxId: string;
  workdir: string;
  repoSummary: string;
  group: FixGroup;
}): Promise<void> {
  const { input, sandboxId, workdir, repoSummary, group } = args;
  const ref = refOf(input);
  const ids = group.checks.map((c) => c.rubricId).join(", ");

  await writeLog(ref, "AGENT", "INFO", "fix_group_started", `Fixing ${group.label}: ${ids}...`);

  if (!process.env.OPEN_ROUTER_KEY) {
    await prisma.agentPlanCheck.updateMany({
      where: { id: { in: group.checks.map((c) => c.id) } },
      data: { outcome: "FAILED", reason: "No model configured." },
    });
    await writeLog(ref, "AGENT", "WARN", "fix_skipped", `Skipped ${ids}: no model configured.`);
    return;
  }

  const sandbox = await connectSandbox(sandboxId);
  const tools = sandboxTools(sandbox, { workdir }) as AgentTool[];

  // The fix can generate an image (e.g. an OG/social image) via OpenRouter
  // (same key). Tag it with the group so the code panel attributes it.
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
            rubricId: group.id,
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
          { path: String(a.path ?? ""), action: e.toolName === "write_file" ? "create" : "modify", rubricId: group.id },
        );
      } else if (e.toolName === "run_command") {
        await writeLog(ref, "AGENT_FILE", "INFO", "command", `$ ${String(a.command ?? "")}`, { rubricId: group.id });
      } else if (e.toolName === "read_file") {
        await writeLog(ref, "AGENT_FILE", "INFO", "read", `Reading ${String(a.path ?? "")}`);
      }
    }
  };

  // Budget steps with the group size: one shared exploration + a few per check.
  const maxSteps = Math.min(40, 10 + group.checks.length * 6);

  try {
    const res = await runAgent({
      system: fixSystemPrompt(repoSummary),
      user: fixGroupUserPrompt(group),
      tools,
      model: group.model,
      maxSteps,
      forceFinalAfterSteps: maxSteps - 4,
      keepToolsAfterFinal: false,
      finalInstruction: "Stop editing and summarize what you changed for each check in one sentence each.",
      temperature: 0,
      onEvent,
    });

    // Optimistic: mark the group's checks FIXED. The verify-and-iterate rescan
    // (workstream A) will downgrade any that didn't actually reach SUCCESS.
    await prisma.agentPlanCheck.updateMany({
      where: { id: { in: group.checks.map((c) => c.id) } },
      data: { outcome: "FIXED", reason: res.finalText.slice(0, 500) },
    });
    await prisma.agentRun
      .update({
        where: { id: input.agentRunId },
        data: { tokensIn: { increment: res.tokensIn }, tokensOut: { increment: res.tokensOut }, model: DEFAULT_MODEL },
      })
      .catch(() => {});
    await writeLog(ref, "AGENT", "INFO", "fix_group_done", `${group.label}: ${res.finalText.slice(0, 200)}`);
  } catch (err) {
    await prisma.agentPlanCheck.updateMany({
      where: { id: { in: group.checks.map((c) => c.id) } },
      data: { outcome: "FAILED", reason: err instanceof Error ? err.message : String(err) },
    });
    await writeLog(ref, "AGENT", "WARN", "fix_group_failed", `Could not fix ${ids}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// 3. Verify by RE-SCANNING the fixed site. Build + serve the repo inside the
// sandbox, run our own checker against it, mark each check's outcome from the
// real result (not the agent's claim), and return the groups still failing so
// the workflow can re-fix them. Best-effort: if build/serve fails, returns
// ok:false and the run proceeds to the PR with the optimistic outcomes.
export interface RescanResult {
  ok: boolean;
  score: number | null;
  done: boolean;
  nextGroups: FixGroup[];
  reason?: string;
}

const SERVE_PORT = 3000;
const STATIC_DIRS = ["out", "dist", "build", ".output/public", "public"];

async function detectServeCommand(
  sandbox: Awaited<ReturnType<typeof connectSandbox>>,
  workdir: string,
): Promise<{ cmd: string; needsBuild: boolean } | null> {
  const pkg = await runCommand(sandbox, "cat package.json 2>/dev/null || echo NONE", { cwd: workdir });
  let scripts: Record<string, string> = {};
  if (!pkg.stdout.includes("NONE")) {
    try {
      scripts = (JSON.parse(pkg.stdout) as { scripts?: Record<string, string> }).scripts ?? {};
    } catch {
      /* ignore */
    }
  }
  // Prefer a real server (needed to verify SSR + content negotiation + headers).
  if (scripts.start) return { cmd: "bun run start || npm run start", needsBuild: !!scripts.build };
  // Static fallback: serve the first build output dir that exists.
  for (const dir of STATIC_DIRS) {
    const test = await runCommand(sandbox, `test -d ${dir} && echo YES || echo NO`, { cwd: workdir });
    if (test.stdout.includes("YES")) {
      return { cmd: `bunx --yes serve -s ${dir} -l ${SERVE_PORT}`, needsBuild: false };
    }
  }
  return null;
}

export async function fixRescanActivity(args: {
  input: AgentFixWorkflowInput;
  sandboxId: string;
  workdir: string;
  iteration: number;
}): Promise<RescanResult> {
  const { input, sandboxId, workdir, iteration } = args;
  const ref = refOf(input);
  await prisma.agentRun.update({ where: { id: input.agentRunId }, data: { status: "VERIFYING" } }).catch(() => {});
  await writeLog(ref, "AGENT", "INFO", "rescan_started", `Re-scanning the fixed site to verify the changes (pass ${iteration})...`);

  const sandbox = await connectSandbox(sandboxId);
  let server: Awaited<ReturnType<typeof startBackground>> | null = null;
  try {
    const serve = await detectServeCommand(sandbox, workdir);
    if (!serve) {
      await writeLog(ref, "AGENT_FILE", "INFO", "verify", "Could not detect how to serve this site; skipping automated re-scan.");
      return { ok: false, score: null, done: false, nextGroups: [], reason: "no serve command" };
    }

    await runCommand(sandbox, "bun install || npm install --no-audit --no-fund", { cwd: workdir, timeoutMs: 5 * 60 * 1000 });
    if (serve.needsBuild) {
      await writeLog(ref, "AGENT_FILE", "INFO", "command", "$ build");
      const build = await runCommand(sandbox, "bun run build || npm run build", { cwd: workdir, timeoutMs: 8 * 60 * 1000 });
      if (build.exitCode !== 0) {
        await writeLog(ref, "AGENT_FILE", "WARN", "verify_failed", `Build failed, cannot re-scan:\n${build.stderr.slice(0, 800)}`);
        return { ok: false, score: null, done: false, nextGroups: [], reason: "build failed" };
      }
    }

    // Start the server in the background and wait for it to answer.
    server = await startBackground(sandbox, serve.cmd, {
      cwd: workdir,
      envs: { PORT: String(SERVE_PORT), HOST: "0.0.0.0", HOSTNAME: "0.0.0.0", NODE_ENV: "production" },
    });
    const host = getSandboxHost(sandbox, SERVE_PORT);
    const url = `https://${host}`;

    let up = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(4000) });
        if (res.status > 0) {
          up = true;
          break;
        }
      } catch {
        /* not up yet */
      }
    }
    if (!up) {
      await writeLog(ref, "AGENT_FILE", "WARN", "verify_failed", "The site did not start in time; skipping automated re-scan.");
      return { ok: false, score: null, done: false, nextGroups: [], reason: "server did not start" };
    }

    // Re-scan the served site with our own checker.
    const result = await runScrape(url, { maxPages: 6, concurrency: 3 });
    const statusByRubric = new Map<string, string>();
    const summaryByRubric = new Map<string, string>();
    for (const c of result.checks) {
      statusByRubric.set(c.name, c.status);
      summaryByRubric.set(c.name, c.recommendation ?? c.summary);
    }
    const score = result.score.overall;
    await prisma.agentRun.update({ where: { id: input.agentRunId }, data: { scoreAfter: score } }).catch(() => {});
    await writeLog(ref, "AGENT", "INFO", "rescan_done", `Re-scan score: ${score}/100 (pass ${iteration}).`);

    // Mark each approved check from the real result, and collect what still fails.
    const rows = await prisma.agentPlanCheck.findMany({
      where: { agentPlanId: input.agentPlanId },
      orderBy: { seq: "asc" },
    });
    const stillFailing: FixCheckInput[] = [];
    for (const c of rows) {
      const approved = c.mode === "AUTO" || c.choice === "APPROVED";
      if (!approved) continue;
      const st = statusByRubric.get(c.rubricId);
      if (st === "SUCCESS") {
        await prisma.agentPlanCheck.update({ where: { id: c.id }, data: { outcome: "FIXED", reason: "Verified passing by re-scan." } });
      } else if (st === "NOT_APPLICABLE" || st === undefined) {
        // Not measured on the re-scan (e.g. site-wide check, or no applicable
        // page in the small re-scan). Leave the optimistic outcome as-is.
      } else {
        const summary = summaryByRubric.get(c.rubricId) ?? "";
        await prisma.agentPlanCheck.update({
          where: { id: c.id },
          data: { outcome: "FAILED", reason: `Still ${st} after the fix: ${summary}`.slice(0, 500) },
        });
        stillFailing.push({
          id: c.id,
          rubricId: c.rubricId,
          category: c.category,
          approach: c.approach,
          recommendation: `${c.recommendation ?? ""} | Re-scan still found this ${st}: ${summary}`.trim().slice(0, 800),
          evidence: c.evidence,
          targetPages: (c.targetPages as unknown as FixCheckInput["targetPages"]) ?? [],
          userSuggestion: c.userSuggestion,
        });
      }
    }

    const nextGroups = groupChecks(stillFailing);
    const done = stillFailing.length === 0;
    if (done) {
      await writeLog(ref, "AGENT", "INFO", "rescan_clean", "All targeted checks pass. No further fixes needed.");
    } else {
      await writeLog(ref, "AGENT", "INFO", "rescan_remaining", `${stillFailing.length} check(s) still need work: ${stillFailing.map((c) => c.rubricId).join(", ")}.`);
    }
    return { ok: true, score, done, nextGroups };
  } catch (err) {
    await writeLog(ref, "AGENT_FILE", "WARN", "verify_failed", `Re-scan could not complete: ${err instanceof Error ? err.message : String(err)}`);
    return { ok: false, score: null, done: false, nextGroups: [], reason: "rescan error" };
  } finally {
    if (server) await server.kill();
  }
}

// (Legacy) build-only verification, kept for fallback. The rescan above builds
// + serves + checks, so the workflow uses that instead.
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
