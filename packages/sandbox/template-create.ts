// Build + deploy the fix-run sandbox template to E2B.
// Run with: bun run template:create   (from packages/sandbox)
import { buildFixTemplate, FIX_TEMPLATE_ALIAS } from "./template";

async function main() {
  console.log(`Building E2B template "${FIX_TEMPLATE_ALIAS}" (node + git + bun)…`);
  await buildFixTemplate();
  console.log(`Done. Use createSandbox({ template: "${FIX_TEMPLATE_ALIAS}" }).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Template build failed:", err);
  process.exit(1);
});
