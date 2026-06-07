#!/usr/bin/env bash
# Seed / update the fix plan catalog. Wrapper around `bun run add-plans`.
# Run from apps/backend:  ./scripts/plan-add.sh
set -euo pipefail
cd "$(dirname "$0")/.."
bun run add-plans
