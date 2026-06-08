import type { RepoInput } from "./types";

// Input the API passes when starting a scrape workflow.
export interface ScrapeWorkflowInput {
  // The Scraping row this run writes to (status, result, logs). When present
  // the activity persists logs + result to the DB. Omit for ad-hoc runs.
  scrapingId?: string;
  // Owners of the Scraping row, needed to attribute logs.
  userId?: string;
  projectId?: string;
  url: string;
  singlePage?: boolean;
  repo?: RepoInput | null;
}
