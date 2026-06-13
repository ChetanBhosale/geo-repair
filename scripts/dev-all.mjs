import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bun = process.execPath;
const children = new Map();

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

function pipeWithPrefix(name, stream, write) {
  const rl = readline.createInterface({ input: stream });
  rl.on("line", (line) => write(`[${name}] ${line}\n`));
}

function start({ name, command, args, cwd, env = {} }) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.set(name, child);
  pipeWithPrefix(name, child.stdout, (line) => process.stdout.write(line));
  pipeWithPrefix(name, child.stderr, (line) => process.stderr.write(line));

  child.on("exit", (code, signal) => {
    children.delete(name);
    if (shuttingDown) return;

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[${name}] exited with ${reason}`);
    stopAll(1);
  });
}

let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children.values()) child.kill("SIGTERM");

  setTimeout(() => {
    for (const child of children.values()) child.kill("SIGKILL");
    process.exit(exitCode);
  }, 1500).unref();
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

const node = findNode();
const tsxCli = path.join(root, "node_modules/tsx/dist/cli.mjs");

start({
  name: "dashboard",
  command: bun,
  args: ["run", "dev"],
  cwd: path.join(root, "apps/dashboard-v2"),
  env: { PORT: "3000" },
});

start({
  name: "web",
  command: bun,
  args: ["run", "dev"],
  cwd: path.join(root, "apps/web"),
  env: { PORT: "3001" },
});

start({
  name: "backend",
  command: bun,
  args: ["run", "dev"],
  cwd: path.join(root, "apps/backend-v2"),
  env: { PORT: "4000", PORT_V2: "4000" },
});

start({
  name: "worker",
  command: node,
  args: [tsxCli, path.join(root, "apps/backend-v2/temporal/worker/index.ts")],
  cwd: root,
});

console.log("[dev] dashboard http://localhost:3000");
console.log("[dev] web       http://localhost:3001");
console.log("[dev] backend   http://localhost:4000/health");
console.log("[dev] worker    Temporal queues via Node");
