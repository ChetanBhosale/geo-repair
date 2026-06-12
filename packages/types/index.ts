export * from "./src/auth";
export * from "./src/billing";
export * from "./src/user";
export * from "./src/scraper";
export * from "./src/github";
export * from "./src/project";
export * from "./src/scraping";
export * from "./src/agent";
export * from "./src/fix";
export * from "./src/entitlements";
export * from "./src/reports";
export * from "./src/feature-interest";

// A few names are defined in two modules; explicit re-exports resolve the
// star-export ambiguity. Consumers that need the other shape import from the
// module subpath (e.g. "@repo/types/fix") directly.
export type { CategoryScore } from "./src/scraping"; // scraper.ts has a legacy shape
export type { SandboxStatus, StartFixResponse } from "./src/agent"; // fix.ts has the older fix-run shapes
