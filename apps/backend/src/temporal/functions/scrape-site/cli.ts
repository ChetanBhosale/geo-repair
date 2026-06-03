// Local runner for the scrape-site audit. Runs the SAME code the Temporal
// activity runs (runAudit), no worker or Temporal connection needed.
//
// Usage:
//   bun run scrape-site <url>           full-site audit
//   bun run scrape-site <url> --page    single page (homepage) only

import { runAudit } from "./activities";
import { normalizeWebsite } from "../../../lib/url";

async function main() {
  const [, , urlArg, ...flags] = process.argv;

  if (!urlArg) {
    console.error("Usage: bun run scrape-site <url> [--page]");
    process.exit(1);
  }

  const website = normalizeWebsite(urlArg);
  if (!website) {
    console.error(`Invalid website url: ${urlArg}`);
    process.exit(1);
  }

  const result = await runAudit({
    url: website,
    singlePage: flags.includes("--page"),
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
