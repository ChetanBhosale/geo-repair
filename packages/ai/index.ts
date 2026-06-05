import OpenAI from "openai";
import type {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import Secrets from "@repo/secrets/backend";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Default model (BYOK via OpenRouter). Override per call with `model`.
export const DEFAULT_MODEL = Secrets.LLM_MODEL;

let client: OpenAI | null = null;

// Shared OpenRouter client (OpenAI-compatible). Reused across calls.
export function getAiClient(): OpenAI {
  if (client) return client;

  if (!Secrets.OPEN_ROUTER_KEY) {
    throw new Error("OPEN_ROUTER_KEY is not set");
  }

  client = new OpenAI({
    apiKey: Secrets.OPEN_ROUTER_KEY,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": Secrets.FRONTEND_URL,
      "X-Title": "GEO Repair",
    },
  });

  return client;
}

export type ChatMessage = ChatCompletionMessageParam;

export interface ChatOptions
  extends Omit<ChatCompletionCreateParamsNonStreaming, "model" | "messages"> {
  model?: string;
}

// Convenience helper: send messages, get the assistant's text back.
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const { model = DEFAULT_MODEL, ...rest } = options;

  const res = await getAiClient().chat.completions.create({
    model,
    messages,
    ...rest,
  });

  return res.choices[0]?.message?.content ?? "";
}

export { OpenAI };
export {
  runAgent,
  type AgentTool,
  type AgentStepLog,
  type RunAgentOptions,
  type RunAgentResult,
} from "./agent";
