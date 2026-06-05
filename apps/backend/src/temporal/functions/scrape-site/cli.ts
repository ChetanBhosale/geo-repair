// Local runner for the scrape-site audit. For testing only: it calls the
// scraper DIRECTLY and prints the report. No DB write, no Temporal, no worker.
//
// Usage:
//   bun run scrape-site <url>           full-site audit
//   bun run scrape-site <url> --page    single page (homepage) only
//   bun run scrape-site <url> --pretty  human-readable report (default: JSON)

import { scrapeSite, formatSiteReport } from "./scraper";
import { normalizeWebsite } from "../../../lib/url";

async function main() {
  const [, , urlArg, ...flags] = process.argv;

  if (!urlArg) {
    console.error("Usage: bun run scrape-site <url> [--page] [--pretty]");
    process.exit(1);
  }

  const website = normalizeWebsite(urlArg);
  if (!website) {
    console.error(`Invalid website url: ${urlArg}`);
    process.exit(1);
  }

  const report = await scrapeSite(website, flags.includes("--page") ? { maxPages: 1 } : {});

  console.log(
    flags.includes("--pretty") ? formatSiteReport(report) : JSON.stringify(report, null, 2)
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
