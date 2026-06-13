import { createRequire } from "node:module";
import { NativeConnection, Worker } from "@temporalio/worker";
import { temporalConnectionConfig } from "../../connection";
import { TASK_QUEUES, WORKER_NAMES } from "../../constants";
import * as activities from "./activities";

const require = createRequire(import.meta.url);

export async function runAgentPlanWorker(): Promise<void> {
  const config = temporalConnectionConfig();

  const connection = await NativeConnection.connect({
    address: config.address,
    apiKey: config.apiKey,
    tls: config.tls,
  });

  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: TASK_QUEUES.agentPlan,
    workflowsPath: require.resolve("./workflows"),
    activities,
    identity: WORKER_NAMES.agentPlan,
  });

  console.log(
    `[temporal] ${WORKER_NAMES.agentPlan} started on "${TASK_QUEUES.agentPlan}"`,
  );
  await worker.run();
}
