// Temporal task queues. Each maps to its own worker. Add new services here.
export const TASK_QUEUES = {
  scraping: "scraping",
  agentPlan: "agent-plan",
  agentFix: "agent-fix",
  agentChat: "agent-chat",
} as const;

export type TaskQueue = (typeof TASK_QUEUES)[keyof typeof TASK_QUEUES];

export const WORKER_NAMES = {
  scraping: "scraping-worker",
  agentPlan: "agent-plan-worker",
  agentFix: "agent-fix-worker",
  agentChat: "agent-chat-worker",
} as const;
