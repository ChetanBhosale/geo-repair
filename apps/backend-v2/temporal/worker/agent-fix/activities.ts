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
import {
  runAgent,
  DEFAULT_MODEL,
  CHEAP_MODEL,
  imageTool,
  type AgentTool,
  type AgentStepLog,
} from "@repo/ai";
import { runScrape } from "../scraper/run";
import type {
  AgentFixDecisionSignal,
  AgentFixWorkflowInput,
  FixCheckInput,
  FixGroup,
  FixSetup,
} from "./workflow-types";
import {
  buildNoVerifiedFixesMessage,
  buildPrBlockerMessage,
  buildScoreGateBlockerMessage,
  formatCommandFailure,
  scoreGateBlockersForPr,
  unresolvedCheckIdsForPr,
} from "./verification";
import type { ScrapeResult, SiteCheck } from "../scraper/types";
import {
  sendFixFailedEmail,
  sendFixPrOpenedEmail,
} from "../../../lib/email-notifications";

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
  return {
    agentRunId: input.agentRunId,
    projectId: input.projectId,
    userId: input.userId,
  };
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
  "aeo-conformance": "aeo-delivery",
};

const GROUP_META: Record<
  string,
  { label: string; cheap: boolean; order: number }
> = {
  crawl: {
    label: "crawl files (robots, sitemap, llms.txt)",
    cheap: true,
    order: 1,
  },
  head: { label: "metadata & head tags", cheap: true, order: 2 },
  semantics: { label: "semantic HTML & accessibility", cheap: false, order: 3 },
  content: {
    label: "content (answerability, definitions, citations)",
    cheap: false,
    order: 4,
  },
  "aeo-delivery": { label: "Markdown-twin delivery", cheap: false, order: 5 },
};

// Bucket repairable score blockers into ordered groups. Unknown ids get their own
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
  groups.sort(
    (a, b) => (GROUP_META[a.id]?.order ?? 99) - (GROUP_META[b.id]?.order ?? 99),
  );
  return groups;
}

function checkNeedsDecision(check: FixCheckInput): boolean {
  return check.mode === "NEEDS_INPUT" && check.choice !== "APPROVED";
}

function decisionOptions(): Prisma.InputJsonValue {
  return [
    {
      id: "try_bigger_change",
      label: "Try a bigger change",
      description: "Let the agent make broader edits for this check.",
    },
    {
      id: "skip",
      label: "Skip this check",
      description: "Do not include this check in the PR.",
    },
  ];
}

function pathFromScannedUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return value.startsWith("/") ? value : null;
  }
}

function pathsFromStoredScan(result: ScrapeResult | null): string[] {
  if (!result) return [];
  const paths = new Set<string>();
  for (const value of [result.url, result.finalUrl]) {
    const path = pathFromScannedUrl(value);
    if (path) paths.add(path);
  }
  for (const log of result.logs ?? []) {
    const path = pathFromScannedUrl(log.page);
    if (path) paths.add(path);
  }
  for (const check of result.checks ?? []) {
    for (const affected of check.affectedPages ?? []) {
      const path = pathFromScannedUrl(affected.page);
      if (path) paths.add(path);
    }
  }
  return [...paths];
}

async function validationPathsForRun(
  input: AgentFixWorkflowInput,
): Promise<string[]> {
  const run = await prisma.agentRun.findUnique({
    where: { id: input.agentRunId },
    include: { scraping: { select: { result: true } } },
  });
  return pathsFromStoredScan(
    (run?.scraping?.result as unknown as ScrapeResult | null) ?? null,
  );
}

function statusNeedsWork(status: string | null | undefined): boolean {
  return status === "FAILED" || status === "MID";
}

function fixabilityToString(value: SiteCheck["fixableByAgent"]): string {
  if (value === "partial") return "partial";
  return value ? "true" : "false";
}

function checkRowToFixInput(check: {
  id: string;
  rubricId: string;
  category: string;
  approach: string | null;
  recommendation: string | null;
  evidence: string | null;
  targetPages: unknown;
  userSuggestion: string | null;
  mode: string;
  choice: string;
  fixableByAgent: string | null;
}): FixCheckInput {
  return {
    id: check.id,
    rubricId: check.rubricId,
    category: check.category,
    approach: check.approach,
    recommendation: check.recommendation,
    evidence: check.evidence,
    targetPages:
      (check.targetPages as unknown as FixCheckInput["targetPages"]) ?? [],
    userSuggestion: check.userSuggestion,
    mode: check.mode,
    choice: check.choice,
    fixableByAgent: check.fixableByAgent,
  };
}

async function createMissingPlanCheck(args: {
  input: AgentFixWorkflowInput;
  check: SiteCheck;
  seq: number;
}) {
  const { input, check, seq } = args;
  const fixable = fixabilityToString(check.fixableByAgent);
  const needsInput = fixable !== "true";
  const firstAffected = check.affectedPages[0];
  return prisma.agentPlanCheck.create({
    data: {
      agentPlanId: input.agentPlanId,
      rubricId: check.name,
      category: check.category,
      tier: check.tier,
      weight: check.weight,
      scanStatus: check.status,
      fixableByAgent: fixable,
      evidence: firstAffected?.issue ?? check.summary,
      recommendation: check.recommendation,
      mode: needsInput ? "NEEDS_INPUT" : "AUTO",
      approach:
        check.recommendation ??
        `Fix ${check.name} so the validation scan reaches a full pass.`,
      targetPages: check.affectedPages.map((affected) => ({
        url: affected.page,
        action: "modify",
        reason: affected.issue,
      })) as unknown as Prisma.InputJsonValue,
      question: needsInput
        ? "This check is blocking a 100/100 validation score and may need a broader change. Should the agent try the bigger change, or skip it?"
        : null,
      options: needsInput ? decisionOptions() : undefined,
      seq,
    },
  });
}

async function repairGroupsAfterValidationFailure(
  input: AgentFixWorkflowInput,
  reason: string,
): Promise<FixGroup[]> {
  const rows = await prisma.agentPlanCheck.findMany({
    where: {
      agentPlanId: input.agentPlanId,
      choice: { not: "DECLINED" },
      outcome: { notIn: ["FIXED", "SKIPPED_BY_USER", "ALREADY_OK"] },
    },
    orderBy: { seq: "asc" },
  });
  return groupChecks(
    rows.map((row) => ({
      ...checkRowToFixInput(row),
      recommendation:
        `${row.recommendation ?? ""} | Validation could not complete: ${reason}`
          .trim()
          .slice(0, 800),
    })),
  );
}

// 1. Create the sandbox, clone the repo, and resolve which checks to fix.
export async function fixSetupActivity(
  input: AgentFixWorkflowInput,
): Promise<FixSetup> {
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

  await writeLog(
    ref,
    "AGENT",
    "INFO",
    "sandbox_creating",
    "Spinning up a sandbox to apply the fixes...",
  );
  const sandbox = await createSandbox();
  await prisma.agentRun.update({
    where: { id: input.agentRunId },
    data: { sandboxId: sandbox.sandboxId, sandboxStatus: "RUNNING" },
  });
  await writeLog(
    ref,
    "AGENT",
    "INFO",
    "sandbox_started",
    `Sandbox ready (${sandbox.sandboxId}).`,
  );

  await writeLog(
    ref,
    "AGENT",
    "INFO",
    "cloning_repo",
    `Cloning ${project.fullName} (${project.defaultBranch})...`,
  );
  const { dir, result } = await cloneRepo(sandbox, {
    cloneUrl: project.cloneUrl,
    branch: project.defaultBranch,
    token: project.account?.accessToken ?? undefined,
  });
  if (result.exitCode !== 0) {
    throw new Error(`Clone failed: ${result.stderr.slice(0, 300)}`);
  }
  await writeLog(
    ref,
    "AGENT",
    "INFO",
    "repo_cloned",
    "Repository cloned. Starting the fixes...",
  );

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
        data: {
          outcome: c.choice === "DECLINED" ? "SKIPPED_BY_USER" : "PENDING",
        },
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
      targetPages:
        (c.targetPages as unknown as FixCheckInput["targetPages"]) ?? [],
      userSuggestion: c.userSuggestion,
      mode: c.mode,
      choice: c.choice,
      fixableByAgent: c.fixableByAgent,
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
- Narrate like a human engineer before tool calls. Use varied, context-aware sentences that explain what the last result suggests and why the next step follows; one sentence is fine for simple steps, two is better when the reasoning would otherwise feel abrupt. Avoid repeating "I will..." or "I am going to...", and do not just restate the command or file name.
- Make the SMALLEST edits that satisfy these checks. Match the file's existing style exactly. Change only what's needed.
- Use only facts already on the site or provided by the user. Never invent claims, pricing, stats, FAQ answers, definitions, or sources.
- Do NOT commit or use git — the harness opens the PR after all checks are done.
- Preserve rendered output; adding meta/JSON-LD/alt/robots/sitemap/llms.txt is safe. Do not rewrite human copy.
- For AEO-delivery checks (markdown-twin, content-negotiation, ai-delivery-headers, aeo-conformance): hand-write framework-idiomatic code (a markdown route/handler serving Content-Type: text/markdown; charset=utf-8, middleware that serves the twin to AI clients on Accept: text/markdown or a known AI-bot User-Agent, the twin response headers X-Robots-Tag: noindex / Vary: Accept / X-Markdown-Tokens / X-Content-Type-Options: nosniff / X-AEO-Version: 1.0, the HTML response headers Vary: Accept + Link rel="alternate", and the .md twin URLs listed in sitemap.xml). Build the twin from the page's OWN content source, never paraphrase. NEVER add a third-party dependency (no @dualmark/* or similar) to the user's repo for this.
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
        check.recommendation
          ? `   Recommendation: ${check.recommendation}`
          : "",
        check.evidence ? `   Evidence: ${check.evidence}` : "",
        check.userSuggestion ? `   User note: ${check.userSuggestion}` : "",
        check.targetPages.length
          ? `   Target pages/files: ${JSON.stringify(check.targetPages)}`
          : "",
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

  await writeLog(
    ref,
    "AGENT",
    "INFO",
    "fix_group_started",
    `Fixing ${group.label}: ${ids}...`,
  );

  if (!process.env.OPEN_ROUTER_KEY) {
    await prisma.agentPlanCheck.updateMany({
      where: { id: { in: group.checks.map((c) => c.id) } },
      data: { outcome: "FAILED", reason: "No model configured." },
    });
    await writeLog(
      ref,
      "AGENT",
      "WARN",
      "fix_skipped",
      `Skipped ${ids}: no model configured.`,
    );
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
            await sandbox.files.write(
              `${workdir}/${rel}`,
              new Blob([Buffer.from(image.base64, "base64")]),
            );
          } catch (e) {
            return `Generated the image but could not write ${rel}: ${e instanceof Error ? e.message : String(e)}`;
          }
          await writeLog(
            ref,
            "AGENT_FILE",
            "INFO",
            "file_change",
            `Generated image ${rel}`,
            {
              path: rel,
              action: "create",
              rubricId: group.id,
            },
          );
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
          {
            path: String(a.path ?? ""),
            action: e.toolName === "write_file" ? "create" : "modify",
            rubricId: group.id,
          },
        );
      } else if (e.toolName === "run_command") {
        await writeLog(
          ref,
          "AGENT_FILE",
          "INFO",
          "command",
          `$ ${String(a.command ?? "")}`,
          { rubricId: group.id },
        );
      } else if (e.toolName === "read_file") {
        await writeLog(
          ref,
          "AGENT_FILE",
          "INFO",
          "read",
          `Reading ${String(a.path ?? "")}`,
        );
      }
    }
  };

  // Internal safety cap only. The paid fix is not metered by customer credits,
  // but the worker still needs a bounded loop.
  const safetyMaxSteps = Math.min(220, Math.max(120, 24 + group.checks.length * 12));

  try {
    const res = await runAgent({
      system: fixSystemPrompt(repoSummary),
      user: fixGroupUserPrompt(group),
      tools,
      model: group.model,
      maxSteps: safetyMaxSteps,
      forceFinalAfterSteps: safetyMaxSteps - 16,
      keepToolsAfterFinal: false,
      finalInstruction:
        "Stop editing and summarize what you changed for each check in one sentence each.",
      temperature: 0,
      onEvent,
    });

    // Keep checks pending after edits. Only the verifier can mark them FIXED,
    // so the UI and PR gate never treat "agent changed files" as proof.
    await prisma.agentPlanCheck.updateMany({
      where: { id: { in: group.checks.map((c) => c.id) } },
      data: { outcome: "PENDING", reason: res.finalText.slice(0, 500) },
    });
    await prisma.agentRun
      .update({
        where: { id: input.agentRunId },
        data: {
          tokensIn: { increment: res.tokensIn },
          tokensOut: { increment: res.tokensOut },
          model: DEFAULT_MODEL,
        },
      })
      .catch(() => {});
    await writeLog(
      ref,
      "AGENT",
      "INFO",
      "fix_group_done",
      `${group.label}: ${res.finalText.slice(0, 200)}`,
    );
  } catch (err) {
    await prisma.agentPlanCheck.updateMany({
      where: { id: { in: group.checks.map((c) => c.id) } },
      data: {
        outcome: "FAILED",
        reason: err instanceof Error ? err.message : String(err),
      },
    });
    await writeLog(
      ref,
      "AGENT",
      "WARN",
      "fix_group_failed",
      `Could not fix ${ids}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// 3. Verify by RE-SCANNING the fixed site. Build + serve the repo inside the
// sandbox, run our own checker against it, mark each check's outcome from the
// real result (not the agent's claim), and return the groups still blocking the
// 100/100 score so the workflow can re-fix them. If the re-scan cannot run, PR
// creation remains blocked.
export interface RescanResult {
  ok: boolean;
  score: number | null;
  done: boolean;
  nextGroups: FixGroup[];
  needsDecision?: boolean;
  reason?: string;
}

const SERVE_PORT = 3000;
const STATIC_DIRS = ["out", "dist", "build", ".output/public", "public"];

async function detectServeCommand(
  sandbox: Awaited<ReturnType<typeof connectSandbox>>,
  workdir: string,
): Promise<{ cmd: string; needsBuild: boolean } | null> {
  const pkg = await runCommand(
    sandbox,
    "cat package.json 2>/dev/null || echo NONE",
    { cwd: workdir },
  );
  let scripts: Record<string, string> = {};
  if (!pkg.stdout.includes("NONE")) {
    try {
      scripts =
        (JSON.parse(pkg.stdout) as { scripts?: Record<string, string> })
          .scripts ?? {};
    } catch {
      /* ignore */
    }
  }
  // Prefer a real server (needed to verify SSR + content negotiation + headers).
  if (scripts.start)
    return {
      cmd: "bun run start || npm run start",
      needsBuild: !!scripts.build,
    };
  // Static fallback: serve the first build output dir that exists.
  for (const dir of STATIC_DIRS) {
    const test = await runCommand(
      sandbox,
      `test -d ${dir} && echo YES || echo NO`,
      { cwd: workdir },
    );
    if (test.stdout.includes("YES")) {
      return {
        cmd: `bunx --yes serve -s ${dir} -l ${SERVE_PORT}`,
        needsBuild: false,
      };
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
  await prisma.agentRun
    .update({ where: { id: input.agentRunId }, data: { status: "VERIFYING" } })
    .catch(() => {});
  await writeLog(
    ref,
    "AGENT",
    "INFO",
    "rescan_started",
    `Re-scanning the fixed site to verify the changes (pass ${iteration})...`,
  );

  const sandbox = await connectSandbox(sandboxId);
  let server: Awaited<ReturnType<typeof startBackground>> | null = null;
  try {
    const serve = await detectServeCommand(sandbox, workdir);
    if (!serve) {
      await writeLog(
        ref,
        "AGENT_FILE",
        "INFO",
        "verify",
        "Could not detect how to serve this site; skipping automated re-scan.",
      );
      return {
        ok: false,
        score: null,
        done: false,
        nextGroups: await repairGroupsAfterValidationFailure(
          input,
          "no serve command",
        ),
        reason: "no serve command",
      };
    }

    await runCommand(
      sandbox,
      "bun install || npm install --no-audit --no-fund",
      { cwd: workdir, timeoutMs: 5 * 60 * 1000 },
    );
    if (serve.needsBuild) {
      await writeLog(ref, "AGENT_FILE", "INFO", "command", "$ build");
      const build = await runCommand(
        sandbox,
        "bun run build || npm run build",
        { cwd: workdir, timeoutMs: 8 * 60 * 1000 },
      );
      if (build.exitCode !== 0) {
        await writeLog(
          ref,
          "AGENT_FILE",
          "WARN",
          "verify_failed",
          `Build failed, cannot re-scan:\n${build.stderr.slice(0, 800)}`,
        );
        return {
          ok: false,
          score: null,
          done: false,
          nextGroups: await repairGroupsAfterValidationFailure(
            input,
            "build failed",
          ),
          reason: "build failed",
        };
      }
    }

    // Start the server in the background and wait for it to answer.
    server = await startBackground(sandbox, serve.cmd, {
      cwd: workdir,
      envs: {
        PORT: String(SERVE_PORT),
        HOST: "0.0.0.0",
        HOSTNAME: "0.0.0.0",
        NODE_ENV: "production",
      },
    });
    const host = getSandboxHost(sandbox, SERVE_PORT);
    const url = `https://${host}`;

    let up = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(url, {
          method: "GET",
          signal: AbortSignal.timeout(4000),
        });
        if (res.status > 0) {
          up = true;
          break;
        }
      } catch {
        /* not up yet */
      }
    }
    if (!up) {
      await writeLog(
        ref,
        "AGENT_FILE",
        "WARN",
        "verify_failed",
        "The site did not start in time; skipping automated re-scan.",
      );
      return {
        ok: false,
        score: null,
        done: false,
        nextGroups: await repairGroupsAfterValidationFailure(
          input,
          "server did not start",
        ),
        reason: "server did not start",
      };
    }

    // Re-scan the served site with our own checker, pinned to the same paths
    // the original paid scan touched so the after-score is comparable.
    const includePaths = await validationPathsForRun(input);
    const result = await runScrape(url, {
      maxPages: Math.max(20, includePaths.length),
      includePaths,
      concurrency: 3,
    });
    const statusByRubric = new Map<string, string>();
    const summaryByRubric = new Map<string, string>();
    for (const c of result.checks) {
      statusByRubric.set(c.name, c.status);
      summaryByRubric.set(c.name, c.recommendation ?? c.summary);
    }
    const score = result.score.overall;
    await prisma.agentRun
      .update({ where: { id: input.agentRunId }, data: { scoreAfter: score } })
      .catch(() => {});
    await writeLog(
      ref,
      "AGENT",
      "INFO",
      "rescan_done",
      `Re-scan score: ${score}/100 (pass ${iteration}).`,
    );

    // Create plan rows for validation blockers discovered after the first plan
    // (for example a regression or a path not covered by the initial failing list).
    const existingRows = await prisma.agentPlanCheck.findMany({
      where: { agentPlanId: input.agentPlanId },
      orderBy: { seq: "asc" },
    });
    const rowsByRubric = new Map(
      existingRows.map((row) => [row.rubricId, row]),
    );
    const createdRows = [];
    let nextSeq =
      existingRows.reduce((max, row) => Math.max(max, row.seq), -1) + 1;
    for (const check of result.checks) {
      if (!statusNeedsWork(check.status) || rowsByRubric.has(check.name)) {
        continue;
      }
      const created = await createMissingPlanCheck({
        input,
        check,
        seq: nextSeq++,
      });
      createdRows.push(created);
      rowsByRubric.set(created.rubricId, created);
    }

    const rows = [...existingRows, ...createdRows];
    const stillFailing: FixCheckInput[] = [];
    for (const c of rows) {
      const st = statusByRubric.get(c.rubricId);
      if (st === "SUCCESS") {
        await prisma.agentPlanCheck.update({
          where: { id: c.id },
          data: {
            scanStatus: st,
            outcome: "FIXED",
            reason: "Verified passing by re-scan.",
          },
        });
      } else if (st === "NOT_APPLICABLE" || st === undefined) {
        // Not measured on the re-scan (e.g. site-wide check, or no applicable
        // page in the small re-scan). Leave the optimistic outcome as-is.
        if (st) {
          await prisma.agentPlanCheck.update({
            where: { id: c.id },
            data: { scanStatus: st },
          });
        }
      } else if (statusNeedsWork(st)) {
        const skipped = c.choice === "DECLINED" || c.outcome === "SKIPPED_BY_USER";
        if (skipped) {
          await prisma.agentPlanCheck.update({
            where: { id: c.id },
            data: {
              scanStatus: st,
              outcome: "SKIPPED_BY_USER",
              reason: "User chose to skip this score blocker.",
            },
          });
          continue;
        }
        const summary = summaryByRubric.get(c.rubricId) ?? "";
        await prisma.agentPlanCheck.update({
          where: { id: c.id },
          data: {
            scanStatus: st,
            outcome:
              c.mode === "NEEDS_INPUT" && c.choice !== "APPROVED"
                ? "PENDING"
                : "FAILED",
            reason: `Still ${st} after the fix: ${summary}`.slice(0, 500),
          },
        });
        stillFailing.push({
          ...checkRowToFixInput(c),
          recommendation:
            `${c.recommendation ?? ""} | Re-scan still found this ${st}: ${summary}`
              .trim()
              .slice(0, 800),
        });
      }
    }

    const nextGroups = groupChecks(stillFailing);
    const readiness = rows.map((row) => ({
      rubricId: row.rubricId,
      mode: row.mode,
      choice: row.choice,
      outcome: row.outcome,
    }));
    const scoreChecks = result.checks.map((check) => ({
      rubricId: check.name,
      status: check.status,
      pointsPossible: check.pointsPossible,
    }));
    const scoreBlockers = scoreGateBlockersForPr({
      score,
      checks: scoreChecks,
      readiness,
    });
    const done = scoreBlockers.length === 0;
    if (done) {
      await writeLog(
        ref,
        "AGENT",
        "INFO",
        "rescan_clean",
        score === 100
          ? "Validation reached 100/100. No further fixes needed."
          : "All remaining score loss was explicitly skipped by the user.",
      );
    } else {
      await writeLog(
        ref,
        "AGENT",
        "INFO",
        "rescan_remaining",
        `${scoreBlockers.length} score blocker(s) remain: ${scoreBlockers.join(", ")}.`,
      );
    }
    await writeLog(
      ref,
      "AGENT_FILE",
      done ? "INFO" : "ERROR",
      done ? "validation_passed" : "verify_failed",
      done
        ? `Validation gate passed. Score: ${score}/100.`
        : `Validation gate failed. Score: ${score}/100.`,
      {
        score,
        scoreBlockers,
        includePaths,
        failedChecks: result.checks
          .filter((check) => statusNeedsWork(check.status))
          .map((check) => `${check.name}:${check.status}`),
      },
    );
    return {
      ok: true,
      score,
      done,
      nextGroups,
      needsDecision: nextGroups.some((group) =>
        group.checks.some(checkNeedsDecision),
      ),
    };
  } catch (err) {
    await writeLog(
      ref,
      "AGENT_FILE",
      "WARN",
      "verify_failed",
      `Re-scan could not complete: ${err instanceof Error ? err.message : String(err)}`,
    );
    return {
      ok: false,
      score: null,
      done: false,
      nextGroups: await repairGroupsAfterValidationFailure(
        input,
        "rescan error",
      ),
      reason: "rescan error",
    };
  } finally {
    if (server) await server.kill();
  }
}

export async function requestFixDecisionActivity(args: {
  input: AgentFixWorkflowInput;
  groups: FixGroup[];
}): Promise<{ pending: number }> {
  const { input, groups } = args;
  const ref = refOf(input);
  const ids = groups.flatMap((group) => group.checks.map((check) => check.id));
  if (ids.length === 0) return { pending: 0 };

  await Promise.all(
    ids.map((id) =>
      prisma.agentPlanCheck.update({
        where: { id },
        data: {
          mode: "NEEDS_INPUT",
          choice: "PENDING",
          selectedOption: null,
          userSuggestion: null,
          outcome: "PENDING",
          question:
            "This check is blocking a 100/100 validation score. Should the agent try a bigger change, or skip it?",
          options: decisionOptions(),
        },
      }),
    ),
  );

  await prisma.agentRun
    .update({
      where: { id: input.agentRunId },
      data: { status: "AWAITING_INPUT" },
    })
    .catch(() => {});

  await writeLog(
    ref,
    "AGENT",
    "WARN",
    "fix_decision_requested",
    "Some checks still need a decision before a PR can be opened.",
    { agentPlanId: input.agentPlanId, checks: ids.length },
  );
  await prisma.log
    .create({
      data: {
        source: "AGENT",
        level: "WARN",
        event: "fix_decision_prompt",
        message: "Some checks still need a decision before a PR can be opened.",
        agentRunId: input.agentRunId,
        agentPlanId: input.agentPlanId,
        projectId: input.projectId,
        userId: input.userId,
      },
    })
    .catch(() => {});

  return { pending: ids.length };
}

export async function collectFixDecisionActivity(args: {
  input: AgentFixWorkflowInput;
  decision: AgentFixDecisionSignal;
}): Promise<{ groups: FixGroup[] }> {
  const { input, decision } = args;
  const ref = refOf(input);
  const byRubric = new Map(
    decision.answers.map((answer) => [answer.rubricId, answer]),
  );

  const rows = await prisma.agentPlanCheck.findMany({
    where: {
      agentPlanId: input.agentPlanId,
      mode: "NEEDS_INPUT",
      choice: "PENDING",
    },
    orderBy: { seq: "asc" },
  });

  const toFix: FixCheckInput[] = [];
  let skipped = 0;

  for (const row of rows) {
    const answer = byRubric.get(row.rubricId);
    if (!answer) continue;

    const declined =
      answer.choice === "DECLINED" || answer.selectedOption === "skip";
    if (declined) {
      skipped += 1;
      await prisma.agentPlanCheck.update({
        where: { id: row.id },
        data: {
          choice: "DECLINED",
          selectedOption: answer.selectedOption ?? "skip",
          userSuggestion: answer.userSuggestion ?? null,
          outcome: "SKIPPED_BY_USER",
          reason: "User chose to skip this unresolved check.",
        },
      });
      continue;
    }

    await prisma.agentPlanCheck.update({
      where: { id: row.id },
      data: {
        choice: "APPROVED",
        selectedOption: answer.selectedOption ?? "try_bigger_change",
        userSuggestion: answer.userSuggestion ?? null,
        outcome: "PENDING",
        reason: "User approved a bigger retry for this check.",
      },
    });

    toFix.push({
      id: row.id,
      rubricId: row.rubricId,
      category: row.category,
      approach: row.approach,
      recommendation: row.recommendation,
      evidence: row.evidence,
      targetPages:
        (row.targetPages as unknown as FixCheckInput["targetPages"]) ?? [],
      userSuggestion: answer.userSuggestion ?? row.userSuggestion,
    });
  }

  await prisma.agentRun
    .update({ where: { id: input.agentRunId }, data: { status: "FIXING" } })
    .catch(() => {});

  await writeLog(
    ref,
    "AGENT",
    "INFO",
    "fix_decision_received",
    `Decision received: ${toFix.length} retry, ${skipped} skipped.`,
  );

  return { groups: groupChecks(toFix) };
}

// Build-only verification is the last gate before pushing code. It intentionally
// throws on install/build failure so the workflow fails before opening a PR.
export async function fixVerifyActivity(args: {
  input: AgentFixWorkflowInput;
  sandboxId: string;
  workdir: string;
}): Promise<void> {
  const { input, sandboxId, workdir } = args;
  const ref = refOf(input);
  await prisma.agentRun
    .update({ where: { id: input.agentRunId }, data: { status: "VERIFYING" } })
    .catch(() => {});

  const sandbox = await connectSandbox(sandboxId);
  const pkg = await runCommand(
    sandbox,
    "test -f package.json && cat package.json || echo NO_PKG",
    { cwd: workdir },
  );
  if (pkg.stdout.includes("NO_PKG")) {
    await writeLog(
      ref,
      "AGENT_FILE",
      "INFO",
      "verify",
      "No package.json — static site, skipping build.",
    );
    return;
  }
  // Pick a build command from common scripts.
  const hasBuild = /"build"\s*:/.test(pkg.stdout);
  if (!hasBuild) {
    await writeLog(
      ref,
      "AGENT_FILE",
      "INFO",
      "verify",
      "No build script found, skipping build verification.",
    );
    return;
  }
  await writeLog(ref, "AGENT_FILE", "INFO", "command", "$ (install) && build");
  const install = await runCommand(
    sandbox,
    "bun install || npm install --no-audit --no-fund",
    { cwd: workdir, timeoutMs: 5 * 60 * 1000 },
  );
  if (install.exitCode !== 0) {
    const reason = formatCommandFailure("Install", install);
    await writeLog(ref, "AGENT_FILE", "ERROR", "verify_failed", reason);
    throw new Error(buildPrBlockerMessage(reason));
  }
  const build = await runCommand(sandbox, "bun run build || npm run build", {
    cwd: workdir,
    timeoutMs: 8 * 60 * 1000,
  });
  if (build.exitCode === 0) {
    await writeLog(ref, "AGENT_FILE", "INFO", "verify", "Build passed.");
  } else {
    const reason = formatCommandFailure("Build", build);
    await writeLog(ref, "AGENT_FILE", "ERROR", "verify_failed", reason);
    throw new Error(buildPrBlockerMessage(reason));
  }
}

export async function assertPrReadyActivity(
  input: AgentFixWorkflowInput,
): Promise<void> {
  const run = await prisma.agentRun.findUnique({
    where: { id: input.agentRunId },
    select: { scoreAfter: true },
  });
  const rows = await prisma.agentPlanCheck.findMany({
    where: { agentPlanId: input.agentPlanId },
    select: {
      rubricId: true,
      mode: true,
      choice: true,
      outcome: true,
      scanStatus: true,
      weight: true,
    },
    orderBy: { seq: "asc" },
  });
  const unresolved = unresolvedCheckIdsForPr(
    rows.map((row) => ({
      rubricId: row.rubricId,
      mode: row.mode,
      choice: row.choice,
      outcome: row.outcome,
    })),
  );
  if (unresolved.length > 0) {
    throw new Error(
      `PR was not opened because these checks are still unresolved: ${unresolved.join(", ")}.`,
    );
  }

  const scoreBlockers = scoreGateBlockersForPr({
    score: run?.scoreAfter,
    checks: rows.map((row) => ({
      rubricId: row.rubricId,
      status: row.scanStatus,
      pointsPossible: row.weight,
    })),
    readiness: rows.map((row) => ({
      rubricId: row.rubricId,
      mode: row.mode,
      choice: row.choice,
      outcome: row.outcome,
    })),
  });
  if (scoreBlockers.length > 0) {
    throw new Error(buildScoreGateBlockerMessage(scoreBlockers));
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
  const status = await runCommand(sandbox, "git status --porcelain", {
    cwd: workdir,
  });
  if (!status.stdout.trim()) {
    await prisma.agentRun.update({
      where: { id: input.agentRunId },
      data: { status: "COMPLETED", finishedAt: new Date() },
    });
    await writeLog(
      ref,
      "AGENT",
      "INFO",
      "no_changes",
      "Nothing needed changing — no PR opened.",
    );
    await sendFixPrOpenedEmail(input.agentRunId).catch((err) => {
      console.error("[email] no-change fix notification failed:", err);
    });
    return;
  }

  const fixed = await prisma.agentPlanCheck.count({
    where: { agentPlanId: input.agentPlanId, outcome: "FIXED" },
  });
  if (fixed === 0) {
    const message = buildNoVerifiedFixesMessage();
    await writeLog(ref, "AGENT", "ERROR", "fix_failed", message);
    throw new Error(message);
  }

  await prisma.agentRun
    .update({ where: { id: input.agentRunId }, data: { status: "OPENING_PR" } })
    .catch(() => {});

  const branch = `geo-repair/fix-${input.agentRunId.slice(-8)}`;
  await runCommand(
    sandbox,
    `git config user.email "agent@geo.repair" && git config user.name "GEO Repair Agent"`,
    { cwd: workdir },
  );
  await runCommand(sandbox, `git checkout -b ${branch}`, { cwd: workdir });
  await runCommand(sandbox, `git add -A`, { cwd: workdir });
  await runCommand(
    sandbox,
    `git commit -m "fix: improve AI search readiness (GEO/AEO/SEO)"`,
    { cwd: workdir },
  );

  if (token) {
    await runCommand(
      sandbox,
      `git remote set-url origin https://x-access-token:${token}@github.com/${project.owner}/${project.name}.git`,
      { cwd: workdir },
    );
  }
  await writeLog(
    ref,
    "AGENT_FILE",
    "INFO",
    "command",
    `$ git push origin ${branch}`,
  );
  const push = await runCommand(sandbox, `git push -u origin ${branch}`, {
    cwd: workdir,
    timeoutMs: 3 * 60 * 1000,
  });
  if (push.exitCode !== 0) {
    throw new Error(`Push failed: ${push.stderr.slice(0, 300)}`);
  }

  // Open the PR via the GitHub REST API.
  const body = `Automated GEO/AEO/SEO readiness fixes by GEO Repair.\n\nThis PR applies ${fixed} fix(es) approved in your plan. Changes improve technical AI-search readiness only.`;
  const prRes = await fetch(
    `https://api.github.com/repos/${project.owner}/${project.name}/pulls`,
    {
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
    },
  );

  const pr = (await prRes.json().catch(() => ({}))) as {
    html_url?: string;
    number?: number;
    message?: string;
  };
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
  await writeLog(
    ref,
    "AGENT",
    "INFO",
    "pr_opened",
    `Opened a pull request: ${pr.html_url}`,
    { prUrl: pr.html_url, branch },
  );
  await sendFixPrOpenedEmail(input.agentRunId).catch((err) => {
    console.error("[email] PR opened notification failed:", err);
  });
}

// 5. Tear down the sandbox and clear its id (always runs).
export async function fixTeardownActivity(
  input: AgentFixWorkflowInput,
): Promise<void> {
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
    .update({
      where: { id: input.agentRunId },
      data: { sandboxId: null, sandboxStatus: "KILLED" },
    })
    .catch(() => {});
}

export async function failFixActivity(
  input: AgentFixWorkflowInput,
  message: string,
): Promise<void> {
  const ref = refOf(input);
  await prisma.agentRun
    .update({
      where: { id: input.agentRunId },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    })
    .catch(() => {});
  await prisma.workerStatus
    .updateMany({
      where: { temporalWorkflowId: `agent-fix-${input.agentRunId}` },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    })
    .catch(() => {});
  await writeLog(ref, "AGENT", "ERROR", "fix_failed", message);
  await sendFixFailedEmail(input.agentRunId, message).catch((err) => {
    console.error("[email] fix failure notification failed:", err);
  });
}

export async function fixCompleteActivity(
  input: AgentFixWorkflowInput,
): Promise<void> {
  await prisma.workerStatus
    .updateMany({
      where: { temporalWorkflowId: `agent-fix-${input.agentRunId}` },
      data: { status: "COMPLETED", finishedAt: new Date() },
    })
    .catch(() => {});
}
