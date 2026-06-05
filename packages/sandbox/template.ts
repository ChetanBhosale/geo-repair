import { Template } from "e2b";
import Secrets from "@repo/secrets/backend";

// Alias for our fix-run sandbox template. Pass this to createSandbox(template)
// to spin up a microVM that already has git + node + bun installed.
export const FIX_TEMPLATE_ALIAS = "geo-repair-fix";

// Definition of the template: Node LTS base (node + npm preinstalled), plus git
// and bun, so we can clone a repo and run installs/builds without bootstrapping.
export function fixTemplate() {
  return Template()
    .fromNodeImage("lts")
    .aptInstall(["git", "ca-certificates", "curl", "unzip"])
    // Install bun globally (this repo and many targets use it).
    .runCmd("npm install -g bun", { user: "root" })
    .setWorkdir("/home/user");
}

// Build + deploy the template to E2B under FIX_TEMPLATE_ALIAS.
export async function buildFixTemplate(): Promise<void> {
  if (!Secrets.E2B_SANDBOX_API_KEY) {
    throw new Error("E2B_SANDBOX_API_KEY is not set");
  }

  await Template.build(fixTemplate(), {
    alias: FIX_TEMPLATE_ALIAS,
    apiKey: Secrets.E2B_SANDBOX_API_KEY,
    cpuCount: 2,
    memoryMB: 2048,
  });
}
