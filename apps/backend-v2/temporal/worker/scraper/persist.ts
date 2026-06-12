import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db/generated/prisma/client";
import { runScrape } from "./run";
import type { LogEntry, RepoInput, ScrapeResult } from "./types";
import { projectBrandDataFromScan } from "../../../lib/brand-identity";

function logLevel(level: LogEntry["level"]): "INFO" | "WARN" | "ERROR" {
  return level === "warn" ? "WARN" : level === "error" ? "ERROR" : "INFO";
}

export interface PersistScrapeInput {
  scrapingId: string;
  userId: string;
  projectId: string;
  websiteUrl: string;
  singlePage?: boolean;
  repo?: RepoInput | null;
}

// Runs the scrape and persists logs + result + status to the Scraping /
// WorkerStatus rows. Shared by the offline background runner and the Temporal
// activity so both paths produce identical DB state. Rethrows on failure so
// Temporal can retry.
export async function persistScrapeRun(
  input: PersistScrapeInput,
): Promise<ScrapeResult> {
  const { scrapingId, userId, projectId, websiteUrl } = input;
  try {
    const result = await runScrape(websiteUrl, {
      singlePage: input.singlePage,
      repo: input.repo ?? null,
      onLog: async (entry) => {
        await prisma.log.create({
          data: {
            source: "SCRAPING",
            level: logLevel(entry.level),
            event: entry.event,
            message: entry.message,
            seq: entry.seq,
            scrapingId,
            projectId,
            userId,
          },
        });
      },
    });

    await prisma.scraping.update({
      where: { id: scrapingId },
      data: {
        status: result.status === "completed" ? "COMPLETED" : "FAILED",
        result: result as unknown as Prisma.InputJsonValue,
        score: result.score.overall,
        scoreStatus: result.score.status,
        pagesChecked: result.crawl.pagesChecked,
        pagesFailed: result.crawl.pagesFailed,
        repoVerified:
          result.repoMatch.status === "SUCCESS"
            ? true
            : result.repoMatch.status === "FAILED"
              ? false
              : null,
        error: result.error,
        finishedAt: new Date(),
      },
    });

    await prisma.workerStatus.updateMany({
      where: { scrapingId },
      data: {
        status: result.status === "completed" ? "COMPLETED" : "FAILED",
        error: result.error,
        finishedAt: new Date(),
      },
    });

    const brandData = projectBrandDataFromScan(result);
    if (result.status === "completed" && brandData) {
      await prisma.project.update({
        where: { id: projectId },
        data: brandData,
      });
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.log.create({
      data: {
        source: "SCRAPING",
        level: "ERROR",
        event: "scan_crashed",
        message,
        scrapingId,
        projectId,
        userId,
      },
    });
    await prisma.scraping.update({
      where: { id: scrapingId },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    await prisma.workerStatus.updateMany({
      where: { scrapingId },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    throw err;
  }
}
