import { runCheckupWorker } from "./checkup.worker";
import { runFixSiteWorker } from "./fix-site.worker";
import { runFixChatWorker } from "./fix-chat.worker";

// Entry point that runs all queue workers in one process. Start with
// `bun run worker` (see package.json).
async function main() {
  await Promise.all([
    runCheckupWorker(),
    runFixSiteWorker(),
    runFixChatWorker(),
  ]);
}

main().catch((err) => {
  console.error("[temporal] worker failed:", err);
  process.exit(1);
});
