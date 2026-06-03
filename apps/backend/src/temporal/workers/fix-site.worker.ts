import { NativeConnection, Worker } from "@temporalio/worker";
import { temporalConnectionConfig } from "../connection";
import { TASK_QUEUES } from "../shared";
import * as activities from "../functions/fix-site/activities";

export async function runFixSiteWorker(): Promise<void> {
  const config = temporalConnectionConfig();

  const connection = await NativeConnection.connect({
    address: config.address,
    apiKey: config.apiKey,
    tls: config.tls,
  });

  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: TASK_QUEUES.fixSite,
    workflowsPath: require.resolve("../functions/fix-site/workflows"),
    activities,
  });

  console.log(`[temporal] fix-site worker started on "${TASK_QUEUES.fixSite}"`);
  await worker.run();
}
