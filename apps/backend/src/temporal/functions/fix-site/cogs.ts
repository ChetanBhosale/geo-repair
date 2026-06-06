import Secrets from "@repo/secrets/backend";

function numericEnv(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function tokenCostCents(tokensIn: number, tokensOut: number): number {
  const inputRate = numericEnv(Secrets.COGS_LLM_INPUT_CENTS_PER_MILLION_TOKENS);
  const outputRate = numericEnv(Secrets.COGS_LLM_OUTPUT_CENTS_PER_MILLION_TOKENS);
  return Math.round(
    (Math.max(0, tokensIn) * inputRate + Math.max(0, tokensOut) * outputRate) /
      1_000_000,
  );
}

export function sandboxCostCents(sandboxSeconds: number): number {
  const hourlyRate = numericEnv(Secrets.COGS_E2B_SANDBOX_CENTS_PER_HOUR);
  return Math.round((Math.max(0, sandboxSeconds) * hourlyRate) / 3600);
}

export function imageCostCents(imageCount: number): number {
  const imageRate = numericEnv(Secrets.COGS_IMAGE_CENTS_PER_THUMBNAIL);
  return Math.round(Math.max(0, imageCount) * imageRate);
}
