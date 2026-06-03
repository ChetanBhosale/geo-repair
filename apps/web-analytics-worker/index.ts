// web-analytics-worker entry point.
// All scraper/scoring logic lives in ./scraper. This file just wires a URL to the scraper.
//
// The user provides ONE website URL (its homepage). The scraper discovers every unique URL of
// that same domain on its own and analyzes all of them. So a full SITE audit is the default.
// Pass --page to score only the single URL given.
//
// Usage:
//   bun run index.ts <url>            full site audit (scans every discovered page)  [default]
//   bun run index.ts <url> --page     single-page report (only the URL given)
//   add --json for machine-readable output

import {
  startScraping,
  scrapeSite,
  formatReport,
  formatSiteReport,
} from "./scraper/index.ts";

async function main(websiteUrl: string, singlePage: boolean, asJson: boolean): Promise<void> {
  if (singlePage) {
    const report = await startScraping(websiteUrl);
    console.log(asJson ? JSON.stringify(report, null, 2) : formatReport(report));
  } else {
    const report = await scrapeSite(websiteUrl);
    console.log(asJson ? JSON.stringify(report, null, 2) : formatSiteReport(report));
    // console.log({report})
  }
}

const [, , urlArg, ...flags] = process.argv;
if (!urlArg) {
  console.error("Usage: bun run index.ts <url> [--page] [--json]");
  process.exit(1);
}

await main(urlArg, flags.includes("--page"), flags.includes("--json"));
