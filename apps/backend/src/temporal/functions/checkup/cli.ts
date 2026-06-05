// Local runner for the checkup activity. Runs the same code the Temporal
// activity runs, with no worker or Temporal connection needed.
//
// Usage:
//   bun run checkup <url>
//   bun run checkup <url> --page

import { runCheckup } from "./activities";
import { normalizeWebsite } from "../../../lib/url";

async function main() {
  const [, , urlArg, ...flags] = process.argv;

  if (!urlArg) {
    console.error("Usage: bun run checkup <url> [--page]");
    process.exit(1);
  }

  const website = normalizeWebsite(urlArg);
  if (!website) {
    console.error(`Invalid website url: ${urlArg}`);
    process.exit(1);
  }

  const result = await runCheckup({
    workflowId: `cli-${Date.now()}`,
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
