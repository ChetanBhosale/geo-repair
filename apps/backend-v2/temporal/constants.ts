// Temporal task queues. Each maps to its own worker. Add new services here.
export const TASK_QUEUES = {
  scraping: "scraping",
} as const;

export type TaskQueue = (typeof TASK_QUEUES)[keyof typeof TASK_QUEUES];

export const WORKER_NAMES = {
  scraping: "scraping-worker",
} as const;
