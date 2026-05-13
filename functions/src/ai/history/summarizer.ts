import type { GenerateWithToolsRequest, GenerateWithToolsResult, GeminiPart } from '../llmProvider';
import type { TraceContext } from '../types';

export interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Subset of LLMProvider that summarizeChunk needs. Decoupled so tests can
 * inject a stub without importing the real provider (which pulls in the
 * Gemini SDK + observability).
 */
export interface SummarizerLLM {
  generateWithTools(request: GenerateWithToolsRequest): Promise<GenerateWithToolsResult>;
}

export interface SummarizerDeps {
  llm: SummarizerLLM;
  traceContext: TraceContext;
}

const SYSTEM_INSTRUCTION = `Resume esta porción de conversación entre un entrenador de baloncesto y su copiloto Pick.
- 1-2 frases máximo, en castellano natural.
- Preserva entidades concretas: nombres de equipos, jugadores, fechas, partidos, rivales.
- Tiempo pasado: lo que ya se hizo o se mencionó. Sin meta-comentarios ni "el coach dice...".
- No añadas información que no esté en la conversación.
- No uses listas, viñetas ni Markdown. Sólo texto plano.`;

function turnsToPromptText(turns: HistoryTurn[]): string {
  return turns.map((t) => `${t.role === 'user' ? 'U' : 'A'}: ${t.content}`).join('\n');
}

function extractText(parts: GeminiPart[]): string {
  for (const p of parts) {
    if ('text' in p && typeof p.text === 'string') return p.text;
  }
  return '';
}

/**
 * Summarize a chunk of conversation turns into 1-2 sentences via fast model.
 * Returns null on any failure (network error, empty response) so the caller
 * can fall back to flat truncation.
 */
export async function summarizeChunk(deps: SummarizerDeps, turns: HistoryTurn[]): Promise<string | null> {
  if (turns.length === 0) return null;
  try {
    const result = await deps.llm.generateWithTools({
      systemInstruction: SYSTEM_INSTRUCTION,
      messages: [
        {
          role: 'user',
          parts: [{ text: turnsToPromptText(turns) }],
        },
      ],
      tools: [],
      traceContext: deps.traceContext,
      modelHint: 'fast',
    });
    const text = extractText(result.parts).trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
