import { prisma } from "@repo/db";
import { sendEmail, type TemplateId, type TemplatePropsMap } from "@repo/email";
import Secrets from "@repo/secrets/backend";

type ScoreStatus = "SUCCESS" | "MID" | "FAILED";

function trimBase(url: string): string {
  return url.replace(/\/+$/, "");
}

function dashboardUrl(path = "/dashboard"): string {
  return `${trimBase(Secrets.DASHBOARD_URL)}${path}`;
}

function projectUrl(projectId: string | null | undefined): string {
  return projectId
    ? dashboardUrl(`/dashboard/projects/${encodeURIComponent(projectId)}`)
    : dashboardUrl("/dashboard/projects");
}

function agentRunUrl(projectId: string, agentRunId: string): string {
  return dashboardUrl(
    `/dashboard/projects/${encodeURIComponent(projectId)}/agent/${encodeURIComponent(agentRunId)}`,
  );
}

function tierLabel(tier: string): string {
  return tier
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function scoreStatusForEmail(
  status: string | null,
  score: number | null,
): ScoreStatus {
  if (status === "SUCCESS" || status === "MID" || status === "FAILED") {
    return status;
  }
  if (score == null) return "FAILED";
  if (score >= 80) return "SUCCESS";
  if (score >= 50) return "MID";
  return "FAILED";
}

function shortError(error: string | null | undefined): string | undefined {
  if (!error) return undefined;
  return error.length > 900 ? `${error.slice(0, 897)}...` : error;
}

async function sendBestEffort<K extends TemplateId>(
  id: K,
  props: TemplatePropsMap[K],
  to: string | null | undefined,
): Promise<void> {
  if (!to) return;
  try {
    const result = await sendEmail(id, props, { to });
    if (!result.ok && !result.skipped) {
      console.error(`[email] ${id} failed:`, result.error);
    }
  } catch (err) {
    console.error(`[email] ${id} threw:`, err);
  }
}

export async function sendAccountWelcomeEmail(user: {
  email: string | null;
  name: string | null;
}): Promise<void> {
  await sendBestEffort(
    "accountWelcome",
    {
      name: user.name ?? undefined,
      dashboardUrl: dashboardUrl("/dashboard/projects"),
    },
    user.email,
  );
}

export async function sendScrapingFinishedEmail(
  scrapingId: string,
): Promise<void> {
  const scraping = await prisma.scraping.findUnique({
    where: { id: scrapingId },
    select: {
      status: true,
      websiteUrl: true,
      score: true,
      scoreStatus: true,
      error: true,
      projectId: true,
      user: { select: { email: true } },
    },
  });

  if (!scraping) return;

  if (scraping.status === "COMPLETED") {
    await sendBestEffort(
      "checkupComplete",
      {
        websiteUrl: scraping.websiteUrl,
        score: scraping.score ?? 0,
        scoreStatus: scoreStatusForEmail(scraping.scoreStatus, scraping.score),
        reportUrl: projectUrl(scraping.projectId),
      },
      scraping.user.email,
    );
    return;
  }

  if (scraping.status === "FAILED") {
    await sendBestEffort(
      "scanFailed",
      {
        websiteUrl: scraping.websiteUrl,
        error: shortError(scraping.error),
        retryUrl: projectUrl(scraping.projectId),
      },
      scraping.user.email,
    );
  }
}

export async function sendBillingOrderEmail(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      tier: true,
      amountCents: true,
      currency: true,
      website: true,
      projectId: true,
      user: { select: { email: true } },
    },
  });

  if (!order) return;

  const baseProps = {
    tier: tierLabel(order.tier),
    website: order.website,
  };

  if (order.status === "PAID") {
    await sendBestEffort(
      "paymentReceipt",
      {
        ...baseProps,
        amountCents: order.amountCents,
        currency: order.currency,
      },
      order.user?.email,
    );
    return;
  }

  if (order.status === "FAILED") {
    await sendBestEffort(
      "paymentFailed",
      {
        ...baseProps,
        retryUrl: projectUrl(order.projectId),
      },
      order.user?.email,
    );
    return;
  }

  if (order.status === "REFUNDED") {
    await sendBestEffort(
      "refund",
      {
        ...baseProps,
        amountCents: order.amountCents,
        currency: order.currency,
      },
      order.user?.email,
    );
  }
}

export async function sendFixPlanReadyEmail(
  agentRunId: string,
  checkCount: number,
): Promise<void> {
  const run = await prisma.agentRun.findUnique({
    where: { id: agentRunId },
    select: {
      id: true,
      projectId: true,
      user: { select: { email: true } },
      project: { select: { fullName: true, name: true } },
    },
  });
  if (!run) return;

  await sendBestEffort(
    "fixPlanReady",
    {
      projectName: run.project.fullName || run.project.name,
      checkCount,
      reviewUrl: agentRunUrl(run.projectId, run.id),
    },
    run.user.email,
  );
}

export async function sendFixPrOpenedEmail(agentRunId: string): Promise<void> {
  const run = await prisma.agentRun.findUnique({
    where: { id: agentRunId },
    select: {
      id: true,
      projectId: true,
      prUrl: true,
      fixedChecks: true,
      user: { select: { email: true } },
      project: { select: { fullName: true, name: true } },
    },
  });
  if (!run) return;

  await sendBestEffort(
    "fixPrOpened",
    {
      projectName: run.project.fullName || run.project.name,
      prUrl: run.prUrl ?? undefined,
      fixedChecks: run.fixedChecks,
      dashboardUrl: agentRunUrl(run.projectId, run.id),
    },
    run.user.email,
  );
}

export async function sendFixFailedEmail(
  agentRunId: string,
  error?: string,
): Promise<void> {
  const run = await prisma.agentRun.findUnique({
    where: { id: agentRunId },
    select: {
      id: true,
      projectId: true,
      error: true,
      user: { select: { email: true } },
      project: { select: { fullName: true, name: true } },
    },
  });
  if (!run) return;

  await sendBestEffort(
    "fixFailed",
    {
      projectName: run.project.fullName || run.project.name,
      error: shortError(error ?? run.error),
      dashboardUrl: agentRunUrl(run.projectId, run.id),
    },
    run.user.email,
  );
}

export async function sendChatLimitReachedEmail(
  agentRunId: string,
): Promise<void> {
  const run = await prisma.agentRun.findUnique({
    where: { id: agentRunId },
    select: {
      prUrl: true,
      user: { select: { email: true } },
      project: { select: { fullName: true, name: true } },
    },
  });
  if (!run) return;

  await sendBestEffort(
    "chatLimitReached",
    {
      projectName: run.project.fullName || run.project.name,
      prUrl: run.prUrl ?? undefined,
    },
    run.user.email,
  );
}
