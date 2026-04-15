import { LLMResult, LLMGenerateRequest } from "./types";
import { ObservabilityService } from "./observability";

const DEFAULT_MODELS = [
  "gemini-2.5-flash-preview-04-17",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

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
        if (error.message !== "API Error") {
          modelIndex++;
          continue;
        }
        throw new Error("Fallo en la comunicación con la IA.");
      }
    }

    throw new Error("Todos los modelos de Gemini están saturados. Inténtalo más tarde.");
  }
}
