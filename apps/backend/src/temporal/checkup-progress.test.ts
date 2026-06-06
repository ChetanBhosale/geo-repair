import { beforeEach, expect, mock, test } from "bun:test";

type EventRow = {
  id: string;
  runId: string;
  sequence: number;
  phase: string;
  type: string;
  message: string;
  pageUrl: string | null;
  metadata?: unknown;
  createdAt: Date;
};

type RunRow = {
  id: string;
  workflowId: string;
  website: string;
  status: string;
  phase: string;
  pagesTotal: number;
  pagesCompleted: number;
  pagesFailed: number;
  checksEvaluated: number;
  issuesFound: number;
  currentPageUrl: string | null;
  resultKey: string | null;
  error: string | null;
  updatedAt: Date;
};

type EventCreate = {
  sequence: number;
  phase: string;
  type: string;
  message: string;
  pageUrl?: string | null;
  metadata?: unknown;
};

type RunCreateArgs = {
  data: {
    workflowId: string;
    website: string;
    status?: string;
    phase?: string;
    events?: { create: EventCreate };
  };
};

type Increment = { increment: number };
type UpdateValue = string | number | null | Increment;

type RunUpdateArgs = {
  where: { workflowId: string };
  data: Partial<Record<keyof RunRow, UpdateValue>>;
};

type RunFindArgs =
  | {
      where: { workflowId: string };
      select: { id: true; _count: { select: { events: true } } };
    }
  | {
      where: { workflowId: string };
      include: {
        events: {
          orderBy: [{ sequence: "desc" }, { createdAt: "desc" }];
          take: number;
        };
      };
    };

type EventCreateArgs = {
  data: {
    runId: string;
    sequence: number;
    phase: string;
    type: string;
    message: string;
    pageUrl?: string | null;
    metadata?: unknown;
  };
};

type EventFindFirstArgs = {
  where: { runId: string };
  orderBy: { sequence: "desc" };
  select: { sequence: true };
};

type MockTx = {
  $queryRaw(
    strings: TemplateStringsArray,
    workflowId: string,
  ): Promise<{ id: string }[]>;
  checkupRun: {
    create(args: RunCreateArgs): Promise<RunRow>;
    update(args: RunUpdateArgs): Promise<RunRow>;
    findUnique(args: RunFindArgs): Promise<unknown>;
  };
  checkupRunEvent: {
    findFirst(args: EventFindFirstArgs): Promise<{ sequence: number } | null>;
    create(args: EventCreateArgs): Promise<EventRow>;
  };
};

type MockPrisma = MockTx & {
  $transaction<T>(
    fn: (tx: MockTx) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ): Promise<T>;
};

const runs = new Map<string, RunRow>();
const events = new Map<string, EventRow[]>();
let nextId = 1;

function resetStore(): void {
  runs.clear();
  events.clear();
  nextId = 1;
}

function createEvent(runId: string, event: EventCreate): EventRow {
  return {
    id: `event-${nextId++}`,
    runId,
    sequence: event.sequence,
    phase: event.phase,
    type: event.type,
    message: event.message,
    pageUrl: event.pageUrl ?? null,
    metadata: event.metadata,
    createdAt: new Date(
      `2026-06-04T00:00:${String(nextId).padStart(2, "0")}.000Z`,
    ),
  };
}

const prisma: MockPrisma = {
  async $transaction<T>(
    fn: (tx: MockTx) => Promise<T>,
    _options?: { maxWait?: number; timeout?: number },
  ): Promise<T> {
    return fn(prisma);
  },

  async $queryRaw(
    _strings: TemplateStringsArray,
    workflowId: string,
  ): Promise<{ id: string }[]> {
    const run = runs.get(workflowId);
    return run ? [{ id: run.id }] : [];
  },

  checkupRun: {
    async create(args: RunCreateArgs): Promise<RunRow> {
      const run: RunRow = {
        id: `run-${nextId++}`,
        workflowId: args.data.workflowId,
        website: args.data.website,
        status: args.data.status ?? "queued",
        phase: args.data.phase ?? "queued",
        pagesTotal: 0,
        pagesCompleted: 0,
        pagesFailed: 0,
        checksEvaluated: 0,
        issuesFound: 0,
        currentPageUrl: null,
        resultKey: null,
        error: null,
        updatedAt: new Date("2026-06-04T00:00:00.000Z"),
      };
      runs.set(run.workflowId, run);
      events.set(run.id, []);
      if (args.data.events?.create) {
        events.get(run.id)!.push(createEvent(run.id, args.data.events.create));
      }
      return run;
    },

    async update(args: RunUpdateArgs): Promise<RunRow> {
      const run = runs.get(args.where.workflowId);
      if (!run) throw new Error("run not found");

      for (const [key, value] of Object.entries(args.data)) {
        if (value === undefined) continue;
        if (
          typeof value === "object" &&
          value !== null &&
          "increment" in value
        ) {
          const current = run[key as keyof RunRow];
          if (typeof current !== "number")
            throw new Error(`cannot increment ${key}`);
          (run as Record<string, unknown>)[key] = current + value.increment;
        } else {
          (run as Record<string, unknown>)[key] = value;
        }
      }

      run.updatedAt = new Date("2026-06-04T00:00:10.000Z");
      return run;
    },

    async findUnique(args: RunFindArgs): Promise<unknown> {
      const run = runs.get(args.where.workflowId);
      if (!run) return null;
      const runEvents = events.get(run.id) ?? [];

      if ("select" in args) {
        return { id: run.id, _count: { events: runEvents.length } };
      }

      return {
        ...run,
        events: [...runEvents]
          .sort((a, b) => b.sequence - a.sequence)
          .slice(0, args.include.events.take),
      };
    },
  },

  checkupRunEvent: {
    async findFirst(
      args: EventFindFirstArgs,
    ): Promise<{ sequence: number } | null> {
      const runEvents = events.get(args.where.runId) ?? [];
      const lastEvent = [...runEvents].sort(
        (a, b) => b.sequence - a.sequence,
      )[0];
      return lastEvent ? { sequence: lastEvent.sequence } : null;
    },

    async create(args: EventCreateArgs): Promise<EventRow> {
      const event = createEvent(args.data.runId, args.data);
      const runEvents = events.get(args.data.runId);
      if (!runEvents) throw new Error("run events not found");
      runEvents.push(event);
      return event;
    },
  },
};

mock.module("@repo/db", () => ({ prisma }));

const {
  appendCheckupRunEvent,
  createCheckupRun,
  getCheckupProgress,
  setCheckupProgress,
} = await import("./checkup-progress.ts");

beforeEach(() => {
  resetStore();
});

test("progress helpers create, update, append, and read checkup progress", async () => {
  await createCheckupRun("workflow-1", "https://example.com");
  await setCheckupProgress("workflow-1", {
    status: "running",
    phase: "scoring_pages",
    pagesTotal: 2,
    currentPageUrl: "https://example.com/pricing",
  });
  await setCheckupProgress(
    "workflow-1",
    { currentPageUrl: null },
    { pagesCompleted: 1, checksEvaluated: 23, issuesFound: 4 },
  );
  await appendCheckupRunEvent("workflow-1", {
    phase: "scoring_pages",
    type: "page_completed",
    message: "Finished https://example.com/pricing.",
    pageUrl: "https://example.com/pricing",
    metadata: { score: 82 },
  });

  const progress = await getCheckupProgress("workflow-1");

  expect(progress?.workflowId).toBe("workflow-1");
  expect(progress?.status).toBe("running");
  expect(progress?.phase).toBe("scoring_pages");
  expect(progress?.pagesTotal).toBe(2);
  expect(progress?.pagesCompleted).toBe(1);
  expect(progress?.checksEvaluated).toBe(23);
  expect(progress?.issuesFound).toBe(4);
  expect(progress?.currentPageUrl).toBeNull();
  expect(progress?.percent).toBe(65);
  expect(progress?.events.map((event) => event.type)).toEqual([
    "queued",
    "page_completed",
  ]);
  expect(progress?.recentPages).toEqual([
    {
      url: "https://example.com/pricing",
      status: "completed",
      score: 82,
    },
  ]);
});
