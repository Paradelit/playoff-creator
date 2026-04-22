import { LLMResult, LLMGenerateRequest, TraceContext } from "./types";
import { ObservabilityService } from "./observability";
import {
  geminiMessagesToOpenAI,
  toolsToOpenAI,
  openAIResponseToGeminiParts,
  OpenAIResponse,
} from "./openRouterAdapter";

type Provider = "gemini" | "openrouter";

interface ProviderModel {
  provider: Provider;
  model: string;
}

const DEFAULT_PROVIDERS: ProviderModel[] = [
  { provider: "gemini", model: "gemini-2.5-flash" },
  { provider: "gemini", model: "gemini-2.5-flash-lite" },
  { provider: "gemini", model: "gemini-3-flash" },
  // OpenRouter free-tier fallbacks (auto-router + specific models)
  { provider: "openrouter", model: "openrouter/free" },
  { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
  { provider: "openrouter", model: "nvidia/nemotron-3-super:free" },
];

// With 6 models in the fallback chain, we must stay under the 300s GCF limit.
// We skip to the next model immediately on 429/503.
const MAX_RETRIES_PER_MODEL = 1;
const BASE_BACKOFF_MS = 800;
const GLOBAL_TIMEOUT_MS = 280_000; // Stop trying new models after 280s
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const isOverloadedStatus = (status: number) =>
  status === 503 || status === 500 || status === 502 || status === 504 || status === 429;

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
  private geminiApiKey: string;
  private openRouterApiKey: string;
  private providers: ProviderModel[];
  private observability: ObservabilityService;

  constructor(deps: {
    apiKey: string;
    openRouterApiKey?: string;
    observability: ObservabilityService;
    providers?: ProviderModel[];
  }) {
    this.geminiApiKey = deps.apiKey;
    this.openRouterApiKey = deps.openRouterApiKey || "";
    this.observability = deps.observability;
    const configured = deps.providers || DEFAULT_PROVIDERS;
    // Strip OpenRouter entries if no key is configured.
    this.providers = this.openRouterApiKey
      ? configured
      : configured.filter((p) => p.provider !== "openrouter");

    console.log(
      `[LLMProvider] Inicializado con ${this.providers.length} modelos. OpenRouter: ${this.openRouterApiKey ? "Configurado (Key presente)" : "NO configurado (Key ausente)"
      }`
    );
  }

  async generate<T>(request: LLMGenerateRequest): Promise<LLMResult<T>> {
    const startTime = Date.now();
    let lastParseError: Error | null = null;
    let lastErrorMsg = "";

    for (let idx = 0; idx < this.providers.length; idx++) {
      // If we've spent more than 280s, don't even start a new model.
      if (Date.now() - startTime > GLOBAL_TIMEOUT_MS) break;

      const { provider, model } = this.providers[idx];

      for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
        try {
          if (request.onStatus) {
            const suffix = attempt > 0 ? ` (reintento ${attempt})` : "";
            request.onStatus(`La IA está analizando... (modelo: ${model})${suffix}`);
          }

          const start = Date.now();
          const rawResponse =
            provider === "gemini"
              ? await this.callGeminiJson(model, request.prompt)
              : await this.callOpenRouterJson(model, request.prompt);

          if (rawResponse.kind === "throw") throw new Error(rawResponse.error);
          if (rawResponse.kind === "retryable") {
            // Overloaded (503/502/504) — skip to next model, don't waste retries.
            break;
          }
          if (rawResponse.kind === "fatal") {
            console.error(`${provider} API error (${model}):`, rawResponse.error);
            break;
          }

          const latencyMs = Date.now() - start;
          const cleanText = (rawResponse.text || "")
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

          let parsed: T;
          try {
            parsed = JSON.parse(cleanText) as T;
          } catch (parseErr) {
            lastParseError = parseErr as Error;
            console.error(
              `${provider} JSON parse error (${model}):`,
              (parseErr as Error).message,
              "— raw:",
              cleanText.substring(0, 400)
            );
            break;
          }

          this.observability.logGeneration(request.traceContext.span, {
            model,
            input: request.prompt.substring(0, 500),
            output: parsed,
            latencyMs,
            inputTokens: rawResponse.inputTokens,
            outputTokens: rawResponse.outputTokens,
          });

          return {
            data: parsed,
            model,
            latencyMs,
            inputTokens: rawResponse.inputTokens,
            outputTokens: rawResponse.outputTokens,
          };
        } catch (err) {
          const error = err as Error;
          lastErrorMsg = error.message;
          if (error.message === "RATE_LIMIT" || error.message === "FORBIDDEN") {
            // Don't throw — skip to next provider/model so fallback kicks in.
            break;
          }
          if (attempt < MAX_RETRIES_PER_MODEL) {
            await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
            continue;
          }
          break;
        }
      }
    }

    if (lastParseError) {
      throw new Error(
        `La IA devolvió una respuesta no válida (${lastParseError.message}). Inténtalo de nuevo.`
      );
    }
    throw new Error(`Todos los modelos de IA están saturados o fallaron. (Último error: ${lastErrorMsg || "desconocido"}). Inténtalo más tarde.`);
  }

  async generateWithTools(request: GenerateWithToolsRequest): Promise<GenerateWithToolsResult> {
    const startTime = Date.now();
    let lastErrorMsg = "";
    for (let idx = 0; idx < this.providers.length; idx++) {
      // If we've spent more than 280s, don't even start a new model.
      if (Date.now() - startTime > GLOBAL_TIMEOUT_MS) break;

      const { provider, model } = this.providers[idx];

      for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
        try {
          const start = Date.now();
          const result =
            provider === "gemini"
              ? await this.callGeminiTools(model, request)
              : await this.callOpenRouterTools(model, request);

          if (result.kind === "throw") throw new Error(result.error);
          if (result.kind === "retryable") {
            // Overloaded (503/502/504) — skip to next model, don't waste retries.
            break;
          }
          if (result.kind === "fatal") {
            console.error(`${provider} API error (${model}):`, result.error);
            break;
          }

          const latencyMs = Date.now() - start;

          this.observability.logGeneration(request.traceContext.span, {
            model,
            input: JSON.stringify({
              systemPreview: request.systemInstruction.substring(0, 300),
              lastMessage: request.messages[request.messages.length - 1],
              toolCount: request.tools.length,
            }),
            output: result.parts,
            latencyMs,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
          });

          return {
            parts: result.parts,
            finishReason: result.finishReason,
            model,
            latencyMs,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
          };
        } catch (err) {
          const error = err as Error;
          lastErrorMsg = error.message;
          if (error.message === "RATE_LIMIT" || error.message === "FORBIDDEN") break;
          if (attempt < MAX_RETRIES_PER_MODEL) {
            await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
            continue;
          }
          break;
        }
      }
    }

    throw new Error(`Todos los modelos de IA están saturados o fallaron. (Último error: ${lastErrorMsg || "desconocido"}). Inténtalo más tarde.`);
  }

  // ----- Gemini calls -----

  private async callGeminiJson(
    model: string,
    prompt: string
  ): Promise<RawTextResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000),
    });

    if (response.status === 429) return { kind: "throw", error: "RATE_LIMIT" };
    if (response.status === 403) return { kind: "throw", error: "FORBIDDEN" };
    if (isOverloadedStatus(response.status)) return { kind: "retryable" };
    if (!response.ok) {
      const errText = await response.text();
      console.error(`[LLMProvider] API Error ${response.status}:`, errText);
      return { kind: "fatal", error: errText };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return {
      kind: "ok",
      text,
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
    };
  }

  private async callGeminiTools(
    model: string,
    request: GenerateWithToolsRequest
  ): Promise<RawToolsResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;
    const payload: Record<string, unknown> = {
      contents: request.messages,
      systemInstruction: { parts: [{ text: request.systemInstruction }] },
      generationConfig: { temperature: request.temperature ?? 0.5 },
    };
    if (request.tools.length > 0) {
      payload.tools = [{ functionDeclarations: request.tools }];
      payload.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000),
    });

    if (response.status === 429) return { kind: "throw", error: "RATE_LIMIT" };
    if (response.status === 403) return { kind: "throw", error: "FORBIDDEN" };
    if (isOverloadedStatus(response.status)) return { kind: "retryable" };
    if (!response.ok) {
      const errText = await response.text();
      console.error(`[LLMProvider] API Error ${response.status}:`, errText);
      return { kind: "fatal", error: errText };
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const parts = (candidate?.content?.parts as GeminiPart[]) || [];
    return {
      kind: "ok",
      parts,
      finishReason: candidate?.finishReason,
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
    };
  }

  // ----- OpenRouter calls -----

  private async callOpenRouterJson(model: string, prompt: string): Promise<RawTextResult> {
    const payload = {
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    };
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openRouterApiKey}`,
        "HTTP-Referer": "https://playoff-creator.web.app",
        "X-Title": "Playoff Creator",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000),
    });

    if (response.status === 429) return { kind: "throw", error: "RATE_LIMIT" };
    if (response.status === 401 || response.status === 403) {
      return { kind: "throw", error: "FORBIDDEN" };
    }
    if (isOverloadedStatus(response.status)) return { kind: "retryable" };
    if (!response.ok) {
      const errText = await response.text();
      console.error(`[LLMProvider] OpenRouter Error ${response.status}:`, errText);
      return { kind: "fatal", error: errText };
    }

    const data = (await response.json()) as OpenAIResponse;
    if (data.error) return { kind: "fatal", error: data.error.message || "unknown" };
    const text = data.choices?.[0]?.message?.content || "";
    return {
      kind: "ok",
      text,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    };
  }

  private async callOpenRouterTools(
    model: string,
    request: GenerateWithToolsRequest
  ): Promise<RawToolsResult> {
    const messages = geminiMessagesToOpenAI(request.systemInstruction, request.messages);
    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: request.temperature ?? 0.5,
    };
    if (request.tools.length > 0) {
      payload.tools = toolsToOpenAI(request.tools);
      payload.tool_choice = "auto";
    }

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.openRouterApiKey}`,
        "HTTP-Referer": "https://playoff-creator.web.app",
        "X-Title": "Playoff Creator",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000),
    });

    if (response.status === 429) return { kind: "throw", error: "RATE_LIMIT" };
    if (response.status === 401 || response.status === 403) {
      return { kind: "throw", error: "FORBIDDEN" };
    }
    if (isOverloadedStatus(response.status)) return { kind: "retryable" };
    if (!response.ok) {
      const errText = await response.text();
      console.error(`[LLMProvider] OpenRouter Error ${response.status}:`, errText);
      return { kind: "fatal", error: errText };
    }

    const data = (await response.json()) as OpenAIResponse;
    if (data.error) return { kind: "fatal", error: data.error.message || "unknown" };

    const translated = openAIResponseToGeminiParts(data);
    return {
      kind: "ok",
      parts: translated.parts,
      finishReason: translated.finishReason,
      inputTokens: translated.inputTokens,
      outputTokens: translated.outputTokens,
    };
  }
}

type RawTextResult =
  | { kind: "ok"; text: string; inputTokens?: number; outputTokens?: number }
  | { kind: "retryable" }
  | { kind: "fatal"; error: string }
  | { kind: "throw"; error: string };

type RawToolsResult =
  | {
    kind: "ok";
    parts: GeminiPart[];
    finishReason?: string;
    inputTokens?: number;
    outputTokens?: number;
  }
  | { kind: "retryable" }
  | { kind: "fatal"; error: string }
  | { kind: "throw"; error: string };
