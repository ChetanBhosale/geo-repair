import Secrets from "@repo/secrets/backend";

function localQueueSuffix(): string {
  return (
    process.env.TEMPORAL_TASK_QUEUE_SUFFIX ??
    process.env.USER ??
    "local"
  ).replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function isLocalUrl(value: string | undefined): boolean {
  return Boolean(
    value?.includes("localhost") ||
      value?.includes("127.0.0.1") ||
      value?.includes("::1"),
  );
}

function shouldUseLocalTaskQueues(): boolean {
  if (Secrets.NODE_ENV === "production") return false;
  if (process.env.TEMPORAL_TASK_QUEUE_SUFFIX) return true;
  return isLocalUrl(Secrets.WEB_URL) || isLocalUrl(Secrets.DASHBOARD_URL);
}

function taskQueue(name: string): string {
  if (!shouldUseLocalTaskQueues()) return name;
  return `${name}-${localQueueSuffix()}`;
}

// Temporal task queues. Each maps to its own worker. Add new services here.
// Local dev queues are suffixed so Temporal Cloud workers from another
// environment cannot pick up workflows that point at this machine's database.
export const TASK_QUEUES = {
  scraping: taskQueue("scraping"),
  agentPlan: taskQueue("agent-plan"),
  agentFix: taskQueue("agent-fix"),
  agentChat: taskQueue("agent-chat"),
} as const;

export type TaskQueue = (typeof TASK_QUEUES)[keyof typeof TASK_QUEUES];

export const WORKER_NAMES = {
  scraping: "scraping-worker",
  agentPlan: "agent-plan-worker",
  agentFix: "agent-fix-worker",
  agentChat: "agent-chat-worker",
} as const;
