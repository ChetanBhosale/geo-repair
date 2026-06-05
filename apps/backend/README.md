# backend

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Local Dodo checkout testing

Use Dodo test mode locally.

```bash
bun run dev
dodo wh listen
```

When prompted by the Dodo CLI, forward webhooks to:

```text
http://localhost:4000/api/webhooks/dodo
```

Set `ENABLE_DEV_BILLING_FIXTURES=true` to enable:

```text
POST /api/dev/billing/fixture-order
```

That dev-only endpoint creates a gated local order and Dodo checkout session so
the checkout, webhook, return page, and paid-order unlock can be tested before
the full GitHub repo-confirmation flow exists.

This project was created using `bun init` in bun v1.3.3. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
