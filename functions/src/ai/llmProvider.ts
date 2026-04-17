import { LLMResult, LLMGenerateRequest, TraceContext } from "./types";
import { ObservabilityService } from "./observability";

const DEFAULT_MODELS = [
  "gemini-flash-latest",
  "gemini-2.5-flash",
];

/** Part of a Gemini message — either text or functionCall/Response */
export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GenerateWithToolsRequest {
  systemInstruction: string;
  messages: GeminiMessage[];
  tools: ToolDeclaration[];
  traceContext: TraceContext;
  temperature?: number;
}

export interface GenerateWithToolsResult {
  parts: GeminiPart[];
  finishReason?: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export class LLMProvider {
  private apiKey: string;
  private models: string[];
  private observability: ObservabilityService;

  constructor(deps: { apiKey: string; observability: ObservabilityService; models?: string[] }) {
    this.apiKey = deps.apiKey;
    this.models = deps.models || DEFAULT_MODELS;
    this.observability = deps.observability;
  }

  async generate<T>(request: LLMGenerateRequest): Promise<LLMResult<T>> {
    let modelIndex = 0;

    while (modelIndex < this.models.length) {
      const model = this.models[modelIndex];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: request.prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      };

      try {
        if (request.onStatus) {
          request.onStatus(`La IA está analizando... (modelo: ${model})`);
        }

        const start = Date.now();
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000)
        });

        if (response.status === 429) throw new Error("RATE_LIMIT");
        if (response.status === 403) throw new Error("FORBIDDEN");
        if (response.status === 503) {
          modelIndex++;
          if (modelIndex < this.models.length) {
            await new Promise((res) => setTimeout(res, 1000));
          }
          continue;
        }
        if (!response.ok) {
          const errText = await response.text();
          console.error("Gemini API error:", errText);
          throw new Error("API Error");
        }

        const data = await response.json();
        const latencyMs = Date.now() - start;
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const cleanText = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        const parsed = JSON.parse(cleanText) as T;

        const inputTokens = data.usageMetadata?.promptTokenCount;
        const outputTokens = data.usageMetadata?.candidatesTokenCount;

        // Log to observability
        this.observability.logGeneration(request.traceContext.span, {
          model,
          input: request.prompt.substring(0, 500),
          output: parsed,
          latencyMs,
          inputTokens,
          outputTokens,
        });

        return { data: parsed, model, latencyMs, inputTokens, outputTokens };
      } catch (err) {
        const error = err as Error;
        if (error.message === "RATE_LIMIT" || error.message === "FORBIDDEN") {
          throw error;
        }
        // For API errors (like 404 Model Not Found) or network errors, we try the next model
        modelIndex++;
      }
    }

    throw new Error("Todos los modelos de Gemini están saturados. Inténtalo más tarde.");
  }

  /**
   * Single-turn call with function calling enabled.
   * Returns raw parts (text or functionCall) — caller handles the tool loop.
   */
  async generateWithTools(request: GenerateWithToolsRequest): Promise<GenerateWithToolsResult> {
    let modelIndex = 0;

    while (modelIndex < this.models.length) {
      const model = this.models[modelIndex];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

      const payload: Record<string, unknown> = {
        contents: request.messages,
        systemInstruction: { parts: [{ text: request.systemInstruction }] },
        generationConfig: {
          temperature: request.temperature ?? 0.5,
        },
      };
      if (request.tools.length > 0) {
        payload.tools = [{ functionDeclarations: request.tools }];
        payload.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
      }

      try {
        const start = Date.now();
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(25000),
        });

        if (response.status === 429) throw new Error("RATE_LIMIT");
        if (response.status === 403) throw new Error("FORBIDDEN");
        if (response.status === 503) {
          modelIndex++;
          if (modelIndex < this.models.length) {
            await new Promise((res) => setTimeout(res, 1000));
          }
          continue;
        }
        if (!response.ok) {
          const errText = await response.text();
          console.error("Gemini API error:", errText);
          modelIndex++;
          continue;
        }

        const data = await response.json();
        const latencyMs = Date.now() - start;
        const candidate = data.candidates?.[0];
        const parts = (candidate?.content?.parts as GeminiPart[]) || [];
        const finishReason = candidate?.finishReason as string | undefined;
        const inputTokens = data.usageMetadata?.promptTokenCount;
        const outputTokens = data.usageMetadata?.candidatesTokenCount;

        this.observability.logGeneration(request.traceContext.span, {
          model,
          input: JSON.stringify({
            systemPreview: request.systemInstruction.substring(0, 300),
            lastMessage: request.messages[request.messages.length - 1],
            toolCount: request.tools.length,
          }),
          output: parts,
          latencyMs,
          inputTokens,
          outputTokens,
        });

        return { parts, finishReason, model, latencyMs, inputTokens, outputTokens };
      } catch (err) {
        const error = err as Error;
        if (error.message === "RATE_LIMIT" || error.message === "FORBIDDEN") throw error;
        modelIndex++;
      }
    }

    throw new Error("Todos los modelos de Gemini están saturados. Inténtalo más tarde.");
  }
}
