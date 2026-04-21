import { GeminiMessage, GeminiPart, ToolDeclaration } from "./llmProvider";

export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenAIResponse {
  choices?: Array<{
    message?: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: number | string };
}

/**
 * Generates a deterministic tool_call_id from a function call's position
 * in the conversation. Gemini does not have call IDs but OpenAI requires them
 * to link a tool response back to the assistant's call — we reconstruct them
 * consistently so translated history stays coherent.
 */
function toolCallId(messageIndex: number, partIndex: number, name: string): string {
  return `tc_${messageIndex}_${partIndex}_${name}`.slice(0, 64);
}

export function geminiMessagesToOpenAI(
  systemInstruction: string,
  messages: GeminiMessage[]
): OpenAIMessage[] {
  const out: OpenAIMessage[] = [];
  if (systemInstruction) {
    out.push({ role: "system", content: systemInstruction });
  }

  messages.forEach((msg, mIdx) => {
    const textPieces: string[] = [];
    const toolCalls: OpenAIToolCall[] = [];
    const toolResponses: OpenAIMessage[] = [];

    msg.parts.forEach((part, pIdx) => {
      if ("text" in part) {
        textPieces.push(part.text);
      } else if ("functionCall" in part) {
        toolCalls.push({
          id: toolCallId(mIdx, pIdx, part.functionCall.name),
          type: "function",
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {}),
          },
        });
      } else if ("functionResponse" in part) {
        // Gemini function responses come on "user" messages; in OpenAI they are
        // separate messages with role=tool. We pair them with the matching
        // assistant tool_call by searching backwards for the same function name.
        let matchedId = "";
        for (let i = mIdx - 1; i >= 0 && !matchedId; i--) {
          const prev = messages[i];
          if (prev.role !== "model") continue;
          prev.parts.forEach((pp, ppIdx) => {
            if (!matchedId && "functionCall" in pp && pp.functionCall.name === part.functionResponse.name) {
              matchedId = toolCallId(i, ppIdx, pp.functionCall.name);
            }
          });
        }
        toolResponses.push({
          role: "tool",
          tool_call_id: matchedId || toolCallId(mIdx, pIdx, part.functionResponse.name),
          name: part.functionResponse.name,
          content: JSON.stringify(part.functionResponse.response ?? {}),
        });
      }
    });

    if (msg.role === "user") {
      // user text (if any) first, then any tool responses as their own messages
      if (textPieces.length > 0) {
        out.push({ role: "user", content: textPieces.join("\n") });
      }
      out.push(...toolResponses);
    } else {
      // assistant message: text + tool_calls live on the same message
      const assistantMsg: OpenAIMessage = {
        role: "assistant",
        content: textPieces.length > 0 ? textPieces.join("\n") : null,
      };
      if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls;
      out.push(assistantMsg);
    }
  });

  return out;
}

export function toolsToOpenAI(tools: ToolDeclaration[]): OpenAITool[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export function openAIResponseToGeminiParts(data: OpenAIResponse): {
  parts: GeminiPart[];
  finishReason?: string;
  inputTokens?: number;
  outputTokens?: number;
} {
  const choice = data.choices?.[0];
  const msg = choice?.message;
  const parts: GeminiPart[] = [];

  if (msg?.content) {
    parts.push({ text: msg.content });
  }
  if (msg?.tool_calls && msg.tool_calls.length > 0) {
    for (const call of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = { _raw: call.function.arguments };
      }
      parts.push({ functionCall: { name: call.function.name, args } });
    }
  }

  return {
    parts,
    finishReason: choice?.finish_reason,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  };
}
