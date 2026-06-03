import { NativeConnection, Worker } from "@temporalio/worker";
import { temporalConnectionConfig } from "../connection";
import { TASK_QUEUES } from "../shared";
import * as activities from "../functions/scrape-site/activities";

export async function runScrapeSiteWorker(): Promise<void> {
  const config = temporalConnectionConfig();

  const connection = await NativeConnection.connect({
    address: config.address,
    apiKey: config.apiKey,
    tls: config.tls,
  });

  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: TASK_QUEUES.scrapeSite,
    workflowsPath: require.resolve("../functions/scrape-site/workflows"),
    activities,
  });

  console.log(`[temporal] scrape-site worker started on "${TASK_QUEUES.scrapeSite}"`);
  await worker.run();
}
