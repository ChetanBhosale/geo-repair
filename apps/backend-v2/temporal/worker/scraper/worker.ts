import { createRequire } from "node:module";
import { NativeConnection, Worker } from "@temporalio/worker";
import { temporalConnectionConfig } from "../../connection";
import { TASK_QUEUES, WORKER_NAMES } from "../../constants";
import * as activities from "./run-activity";

const require = createRequire(import.meta.url);

export async function runScraperWorker(): Promise<void> {
  const config = temporalConnectionConfig();

  const connection = await NativeConnection.connect({
    address: config.address,
    apiKey: config.apiKey,
    tls: config.tls,
  });

  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: TASK_QUEUES.scraping,
    workflowsPath: require.resolve("./workflows"),
    activities,
    identity: WORKER_NAMES.scraping,
  });

  console.log(
    `[temporal] ${WORKER_NAMES.scraping} started on "${TASK_QUEUES.scraping}"`,
  );
  await worker.run();
}
