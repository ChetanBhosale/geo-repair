// Runs every Temporal worker in one process. Start with `bun run worker`.
// Add new workers to the Promise.all as services are built.
import { runScraperWorker } from "./scraper/worker";

async function main() {
  await Promise.all([runScraperWorker()]);
}

main().catch((err) => {
  console.error("[temporal] worker process failed:", err);
  process.exit(1);
});
