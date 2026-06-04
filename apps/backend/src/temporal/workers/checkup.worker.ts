import { NativeConnection, Worker } from "@temporalio/worker";
import { temporalConnectionConfig } from "../connection";
import { TASK_QUEUES } from "../shared";
import * as activities from "../functions/checkup/activities";

export async function runCheckupWorker(): Promise<void> {
  const config = temporalConnectionConfig();

  const connection = await NativeConnection.connect({
    address: config.address,
    apiKey: config.apiKey,
    tls: config.tls,
  });

  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: TASK_QUEUES.checkup,
    workflowsPath: require.resolve("../functions/checkup/workflows"),
    activities,
  });

  console.log(`[temporal] checkup worker started on "${TASK_QUEUES.checkup}"`);
  await worker.run();
}
