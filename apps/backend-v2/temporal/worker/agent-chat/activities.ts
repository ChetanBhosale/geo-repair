import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import {
  connectSandbox,
  createSandbox,
  cloneRepo,
  runCommand,
  sandboxTools,
} from "@repo/sandbox";
import { runAgent, DEFAULT_MODEL, imageTool, type AgentTool, type AgentStepLog } from "@repo/ai";
import { getPrStatus } from "../../../lib/github";
import type { AgentChatWorkflowInput } from "./workflow-types";

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

// Rebuild the agent's memory from the DB: what the plan was, what got fixed,
// which files changed, and the recent conversation. This is the durable context
// we hand the model each turn (the sandbox gives it the live code).
async function buildContext(agentRunId: string): Promise<string> {
  const run = await prisma.agentRun.findUnique({
    where: { id: agentRunId },
    include: { plan: { include: { checks: { orderBy: { seq: "asc" } } } } },
  });

  const parts: string[] = [];
  if (run?.plan?.summary) parts.push(`Plan summary: ${run.plan.summary}`);
  if (run?.plan?.checks?.length) {
    const lines = run.plan.checks.map(
      (c) => `- ${c.rubricId}: ${c.outcome}${c.approach ? ` — ${c.approach}` : ""}`,
    );
    parts.push(`Checks and outcomes:\n${lines.join("\n")}`);
  }

  const fileLogs = await prisma.log.findMany({
    where: { agentRunId, source: "AGENT_FILE", event: "file_change" },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const files = [
    ...new Set(
      fileLogs
        .map((l) => (l.data as { path?: string } | null)?.path)
        .filter((p): p is string => !!p),
    ),
  ];
  if (files.length) parts.push(`Files changed so far:\n${files.map((f) => `- ${f}`).join("\n")}`);

  if (run?.prUrl) parts.push(`Open PR: ${run.prUrl} (branch ${run.branch ?? "?"})`);

  // Recent conversation transcript.
  const msgs = await prisma.log.findMany({
    where: { agentRunId, source: { in: ["USER", "AGENT"] }, event: { in: ["user_message", "agent_message"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const transcript = msgs
    .reverse()
    .map((m) => `${m.source === "USER" ? "User" : "Agent"}: ${m.message ?? ""}`)
    .join("\n");
  if (transcript) parts.push(`Recent conversation:\n${transcript}`);

  return parts.join("\n\n");
}

function chatSystemPrompt(): string {
  return `You are the GEO Repair fix agent in post-PR follow-up mode. The fix PR for this repo is already open and you are back in a sandbox on the SAME fix branch, with full read/edit/write/run tools. Earlier work and the conversation are your memory; build on them, do not start over.

Apply the user's latest request to the fix branch.
Rules:
- Think out loud: one short, jargon-free sentence before a tool call (streams live).
- Make the SMALLEST edit that satisfies the request; match the file's existing style. Stay within the spirit of the GEO/AEO/SEO fix.
- Do NOT run git yourself; the harness commits and pushes after you finish.
- Never invent claims, content, or sources. The user can only send text — if you need an image, ask for a URL or generate one.
- If something can't be done safely, say so and make no edits.
When done, end with one short sentence describing what you changed (or that nothing was needed).`;
}

// One chat turn: revive/create the sandbox (keep it alive), inspect + edit on
// the fix branch, commit + push to update the PR, persist the reply, and check
// if the PR has been merged.
export async function runChatActivity(input: AgentChatWorkflowInput): Promise<void> {
  const ref: LogRef = { agentRunId: input.agentRunId, projectId: input.projectId, userId: input.userId };

  const run = await prisma.agentRun.findFirst({
    where: { id: input.agentRunId, userId: input.userId },
    include: { project: { include: { account: { select: { accessToken: true } } } } },
  });
  if (!run || !run.project) throw new Error("Run/project not found for chat.");
  const token = run.project.account?.accessToken ?? undefined;
  const workdir = "/home/user/repo";

  try {
    // Revive the sandbox if alive; otherwise create a fresh one + re-clone the
    // fix branch. We keep this sandbox alive across the conversation.
    let sandbox = null as Awaited<ReturnType<typeof createSandbox>> | null;
    if (run.sandboxId) {
      try {
        const existing = await connectSandbox(run.sandboxId);
        const probe = await runCommand(existing, "git rev-parse --abbrev-ref HEAD", { cwd: workdir });
        if (probe.exitCode === 0) sandbox = existing;
      } catch {
        sandbox = null;
      }
    }

    if (!sandbox) {
      await writeLog(ref, "AGENT", "INFO", "sandbox_creating", "Starting a sandbox for this chat...");
      sandbox = await createSandbox();
      const { result } = await cloneRepo(sandbox, {
        cloneUrl: run.project.cloneUrl,
        branch: run.branch ?? run.project.defaultBranch,
        token,
      });
      if (result.exitCode !== 0) throw new Error(`Clone failed: ${result.stderr.slice(0, 200)}`);
      await runCommand(sandbox, `git config user.email "agent@geo.repair" && git config user.name "GEO Repair Agent"`, { cwd: workdir });
      await prisma.agentRun.update({
        where: { id: run.id },
        data: { sandboxId: sandbox.sandboxId, sandboxStatus: "RUNNING" },
      });
    }

    const context = await buildContext(input.agentRunId);
    const tools = sandboxTools(sandbox, { workdir }) as AgentTool[];
    if (process.env.OPEN_ROUTER_KEY) {
      tools.push(
        imageTool({
          onImage: async (image, a) => {
            const rel = a.path ?? "public/og.png";
            try {
              await sandbox!.files.write(`${workdir}/${rel}`, new Blob([Buffer.from(image.base64, "base64")]));
            } catch (e) {
              return `Generated image but could not write ${rel}: ${e instanceof Error ? e.message : String(e)}`;
            }
            await writeLog(ref, "AGENT_FILE", "INFO", "file_change", `Generated image ${rel}`, { path: rel, action: "create" });
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
          await writeLog(ref, "AGENT_FILE", "INFO", "file_change", `${e.toolName === "write_file" ? "Created" : "Edited"} ${String(a.path ?? "")}`, {
            path: String(a.path ?? ""),
            action: e.toolName === "write_file" ? "create" : "modify",
          });
        } else if (e.toolName === "run_command") {
          await writeLog(ref, "AGENT_FILE", "INFO", "command", `$ ${String(a.command ?? "")}`);
        } else if (e.toolName === "read_file") {
          await writeLog(ref, "AGENT_FILE", "INFO", "read", `Reading ${String(a.path ?? "")}`);
        }
      }
    };

    const res = await runAgent({
      system: chatSystemPrompt(),
      user: `${context}\n\n---\nUser's request:\n${input.message}`,
      tools,
      maxSteps: 20,
      forceFinalAfterSteps: 16,
      temperature: 0,
      onEvent,
    });

    await prisma.agentRun
      .update({
        where: { id: run.id },
        data: { tokensIn: { increment: res.tokensIn }, tokensOut: { increment: res.tokensOut }, model: DEFAULT_MODEL },
      })
      .catch(() => {});

    // Commit + push any edits so the open PR updates in place.
    const status = await runCommand(sandbox, "git status --porcelain", { cwd: workdir });
    if (status.stdout.trim()) {
      await runCommand(sandbox, `git add -A`, { cwd: workdir });
      await runCommand(sandbox, `git commit -m "fix: chat refinement"`, { cwd: workdir });
      if (token) {
        await runCommand(
          sandbox,
          `git remote set-url origin https://x-access-token:${token}@github.com/${run.project.owner}/${run.project.name}.git`,
          { cwd: workdir },
        );
      }
      const push = await runCommand(sandbox, `git push origin ${run.branch ?? "HEAD"}`, { cwd: workdir, timeoutMs: 3 * 60 * 1000 });
      if (push.exitCode === 0) {
        await writeLog(ref, "AGENT", "INFO", "pr_updated", "Pushed the change; the PR is updated.");
      } else {
        await writeLog(ref, "AGENT_FILE", "WARN", "push_failed", `Push failed: ${push.stderr.slice(0, 300)}`);
      }
    }

    // The agent's closing message.
    await writeLog(ref, "AGENT", "INFO", "agent_message", res.finalText.slice(0, 1000) || "Done.");

    // Did the PR get merged? Reflect it (closes chat next time).
    if (run.prNumber) {
      const pr = await getPrStatus(run.project.owner, run.project.name, run.prNumber, token);
      if (pr?.merged) {
        await prisma.agentRun.update({
          where: { id: run.id },
          data: { prMerged: true, prState: "MERGED", prMergedAt: new Date() },
        });
        await writeLog(ref, "AGENT", "INFO", "pr_merged", "The PR has been merged — this run is complete.");
      }
    }
  } finally {
    // Keep the sandbox alive for the conversation; just return to PR_OPENED so
    // the chat composer re-enables and polling settles.
    await prisma.agentRun
      .update({ where: { id: input.agentRunId }, data: { status: "PR_OPENED" } })
      .catch(() => {});
  }
}
