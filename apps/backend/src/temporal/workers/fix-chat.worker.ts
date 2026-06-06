import { NativeConnection, Worker } from "@temporalio/worker";
import { temporalConnectionConfig } from "../connection";
import { TASK_QUEUES } from "../shared";
import * as activities from "../functions/fix-chat/activities";

export async function runFixChatWorker(): Promise<void> {
  const config = temporalConnectionConfig();

  const connection = await NativeConnection.connect({
    address: config.address,
    apiKey: config.apiKey,
    tls: config.tls,
  });

  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: TASK_QUEUES.fixChat,
    workflowsPath: require.resolve("../functions/fix-chat/workflows"),
    activities,
  });

  console.log(`[temporal] fix-chat worker started on "${TASK_QUEUES.fixChat}"`);
  await worker.run();
}
