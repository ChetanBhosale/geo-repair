import { prisma } from "@repo/db";
import type { ScrapeSiteInput, ScrapeSiteResult } from "../../shared";
import { scrapeSite } from "./scraper";

// Activity for the scrape-site queue. Does the network I/O (fetch + scoring),
// so it lives here and never in the workflow. The full report is saved to the
// DB and only a small key + summary is returned, keeping the Temporal payload
// well under the 2 MB limit. singlePage caps the crawl to the homepage.
export async function runAudit(input: ScrapeSiteInput): Promise<ScrapeSiteResult> {
  const report = await scrapeSite(input.url, input.singlePage ? { maxPages: 1 } : {});
  const data = JSON.stringify(report);
  const meta = input.meta ?? {};

  const row = await prisma.scrapeGeo.upsert({
    where: { website: input.url },
    create: {
      website: input.url,
      websiteScrapeData: data,
      totalScrapeCount: 1,
      singlePage: Boolean(input.singlePage),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      referer: meta.referer ?? null,
      origin: meta.origin ?? null,
    },
    update: {
      websiteScrapeData: data,
      totalScrapeCount: { increment: 1 },
      singlePage: Boolean(input.singlePage),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      referer: meta.referer ?? null,
      origin: meta.origin ?? null,
    },
  });

  return {
    key: row.id,
    website: row.website,
    overall: report.overall,
    pagesScraped: report.crawl.pagesScraped,
  };
}
