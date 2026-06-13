# geo-repair

## Local Dev

Run everything from the repo root:

```sh
bun run dev:all
```

This starts:

- Dashboard: `http://localhost:3000`
- Web: `http://localhost:3001`
- Backend: `http://localhost:4000/health`
- Temporal worker queues

Four-command mode:

```sh
bun run dev:dashboard
bun run dev:web
bun run dev:backend
bun run dev:worker
```

The Temporal worker intentionally runs through real Node via `tsx`, not Bun. If
your shell does not expose Node 20 or newer as `node`, set it explicitly:

```sh
GEO_REPAIR_NODE=/path/to/node bun run dev:worker
```

## Common Commands

```sh
bun install
bun run lint
bun run check-types
bun run build
```
