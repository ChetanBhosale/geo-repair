import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import { getAiClient, DEFAULT_MODEL } from "./index";

// A tool the agent can call. `parameters` is a JSON Schema object; `execute`
// receives the parsed args and returns a string the model sees as the result.
export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string> | string;
}

export interface AgentStepLog {
  step: number;
  type: "assistant" | "tool_call" | "tool_result";
  // For assistant text / tool result content.
  content?: string;
  // For tool calls.
  toolName?: string;
  toolArgs?: Record<string, unknown>;
}

export interface AgentUsageDelta {
  step: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface RunAgentOptions {
  system: string;
  user: string;
  tools: AgentTool[];
  model?: string;
  // Internal safety cap only. Customer-facing follow-up usage is governed by AI
  // credits, not by this step count.
  maxSteps?: number;
  forceFinalAfterSteps?: number;
  finalInstruction?: string;
  // By default forceFinalAfterSteps strips tools to force a text-only answer
  // (used by the planner to return JSON). Set this to inject the final
  // instruction as a *nudge* while keeping tools available — needed by the fix
  // harness, which still has to run `git commit` after being told to wrap up.
  keepToolsAfterFinal?: boolean;
  temperature?: number;
  maxTokens?: number;
  // Called on every assistant message, tool call, and tool result — for logging.
  onEvent?: (log: AgentStepLog) => void | Promise<void>;
  // Called after each model response with just that response's usage.
  onUsage?: (usage: AgentUsageDelta) => void | Promise<void>;
}

export interface RunAgentResult {
  finalText: string;
  steps: number;
  tokensIn: number;
  tokensOut: number;
  stoppedReason: "done" | "max_steps";
}

function toOpenAiTools(tools: AgentTool[]): ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

// Generic tool-calling agent loop over the OpenRouter (OpenAI-compatible) API.
// Model is env-driven (LLM_MODEL) — swap models without touching code. The loop:
// call model -> if it requests tool calls, run them and feed results back ->
// repeat until the model answers with no tool calls (or the safety cap is hit).
export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const maxSteps = opts.maxSteps ?? 30;
  const client = getAiClient();
  const toolMap = new Map(opts.tools.map((t) => [t.name, t]));

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];

  let tokensIn = 0;
  let tokensOut = 0;
  let finalText = "";
  let finalInstructionInjected = false;

  for (let step = 1; step <= maxSteps; step++) {
    if (
      !finalInstructionInjected &&
      opts.forceFinalAfterSteps &&
      step > opts.forceFinalAfterSteps
    ) {
      messages.push({
        role: "user",
        content:
          opts.finalInstruction ??
          "Stop using tools and return the final answer now.",
      });
      finalInstructionInjected = true;
    }

    const activeTools =
      finalInstructionInjected && !opts.keepToolsAfterFinal ? [] : opts.tools;
    const res = await client.chat.completions.create({
      model,
      messages,
      ...(activeTools.length ? { tools: toOpenAiTools(activeTools) } : {}),
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    });

    const inputTokens = res.usage?.prompt_tokens ?? 0;
    const outputTokens = res.usage?.completion_tokens ?? 0;
    tokensIn += inputTokens;
    tokensOut += outputTokens;
    await opts.onUsage?.({ step, model, inputTokens, outputTokens });

    const choice = res.choices[0];
    const msg = choice?.message;
    if (!msg) break;

    // Record the assistant turn (with any tool calls) verbatim.
    messages.push(msg);

    if (msg.content) {
      finalText = msg.content;
      await opts.onEvent?.({ step, type: "assistant", content: msg.content });
    }

    const toolCalls = msg.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { finalText, steps: step, tokensIn, tokensOut, stoppedReason: "done" };
    }

    // Execute each requested tool call and feed the result back.
    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const tool = toolMap.get(call.function.name);

      let args: Record<string, unknown> = {};
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }

      await opts.onEvent?.({
        step,
        type: "tool_call",
        toolName: call.function.name,
        toolArgs: args,
      });

      let result: string;
      if (!tool) {
        result = `Error: unknown tool "${call.function.name}"`;
      } else {
        try {
          result = await tool.execute(args);
        } catch (err) {
          result = `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      await opts.onEvent?.({ step, type: "tool_result", toolName: call.function.name, content: result });

      const toolMsg: ChatCompletionToolMessageParam = {
        role: "tool",
        tool_call_id: call.id,
        content: result,
      };
      messages.push(toolMsg);
    }
  }

  return { finalText, steps: maxSteps, tokensIn, tokensOut, stoppedReason: "max_steps" };
}
