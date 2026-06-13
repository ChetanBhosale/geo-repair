import { createRequire } from "node:module";
import { NativeConnection, Worker } from "@temporalio/worker";
import { temporalConnectionConfig } from "../../connection";
import { TASK_QUEUES, WORKER_NAMES } from "../../constants";
import * as activities from "./activities";

const require = createRequire(import.meta.url);

export async function runAgentFixWorker(): Promise<void> {
  const config = temporalConnectionConfig();

  const connection = await NativeConnection.connect({
    address: config.address,
    apiKey: config.apiKey,
    tls: config.tls,
  });

  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: TASK_QUEUES.agentFix,
    workflowsPath: require.resolve("./workflows"),
    activities,
    identity: WORKER_NAMES.agentFix,
  });

  console.log(
    `[temporal] ${WORKER_NAMES.agentFix} started on "${TASK_QUEUES.agentFix}"`,
  );
  await worker.run();
}
