// Offline scraper CLI. Usage:
//   bun run scraper https://linkrunner.io          (full multi-page scan)
//   bun run scraper https://linkrunner.io --single (homepage only)
//
// Runs without Temporal and prints the result JSON to stdout. Progress logs go to stderr.
import { runScrape } from "./run";

async function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith("--"));
  const singlePage = args.includes("--single");
  if (!target) {
    console.error("Usage: bun run scraper <url> [--single]");
    process.exit(1);
  }

  const result = await runScrape(target, {
    singlePage,
    onLog: (e) => {
      console.error(`  [${e.event}] ${e.message}`);
    },
  });

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.status === "completed" ? 0 : 1);
}

main().catch((err) => {
  console.error("scraper failed:", err);
  process.exit(1);
});
