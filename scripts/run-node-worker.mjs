import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function validNode(command) {
  const result = spawnSync(
    command,
    [
      "-p",
      "JSON.stringify({node:process.versions.node,bun:process.versions.bun||null})",
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0 || !result.stdout) return false;

  try {
    const versions = JSON.parse(result.stdout.trim());
    const major = Number(String(versions.node ?? "").split(".")[0]);
    return !versions.bun && major >= 20;
  } catch {
    return false;
  }
}

function findNode() {
  if (process.env.GEO_REPAIR_NODE && existsSync(process.env.GEO_REPAIR_NODE)) {
    return process.env.GEO_REPAIR_NODE;
  }

  if (validNode("node")) return "node";

  const codexNode = path.join(
    os.homedir(),
    ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node",
  );
  if (existsSync(codexNode) && validNode(codexNode)) return codexNode;

  throw new Error(
    "Node.js is required for the Temporal worker. Set GEO_REPAIR_NODE to a Node >=20 binary.",
  );
}

const node = findNode();
const tsxCli = path.join(root, "node_modules/tsx/dist/cli.mjs");
const workerEntry = path.join(
  root,
  "apps/backend-v2/temporal/worker/index.ts",
);

const child = spawn(node, [tsxCli, workerEntry], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
