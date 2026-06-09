import { getTemporalClient } from "../temporal/client";
import { temporalConnectionConfig } from "../temporal/connection";
import type { TaskQueue } from "../temporal/constants";

// Is a worker actually polling this task queue right now? Temporal's
// describeTaskQueue returns the list of pollers; a non-empty list means at
// least one worker is connected. If no worker is up there is no point enqueuing
// work (it would sit forever) or creating a WorkerStatus row, so callers should
// bail early. Network/Temporal errors are treated as "not running" (false) so
// we fail closed rather than queue into the void.
export async function checkWorkerRunning(taskQueue: TaskQueue): Promise<boolean> {
  try {
    const client = await getTemporalClient();
    const { namespace } = temporalConnectionConfig();
    const res = await client.workflowService.describeTaskQueue({
      namespace,
      taskQueue: { name: taskQueue },
      // TASK_QUEUE_TYPE_WORKFLOW = 1 (the queue workflows are dispatched on).
      taskQueueType: 1,
    });
    return (res.pollers?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
