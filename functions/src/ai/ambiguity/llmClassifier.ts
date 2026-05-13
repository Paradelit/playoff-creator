import type { UserDigest } from '../digest/types';
import type { GeminiPart } from '../llmProvider';
import type { SummarizerLLM } from '../history/summarizer';
import type { TraceContext } from '../types';
import type { AmbiguityResult } from './types';

/**
 * LLM fallback for ambiguity classification (sub-B.4).
 *
 * Runs after the regex heuristic returns "clear". A fast-model call gets a
 * slim view of the digest (teams, sessions, brackets by id+label) and the
 * user message, then returns one of:
 *   - {"kind":"clear"}
 *   - {"kind":"ambiguous","clarification":"...","candidates":[...]}
 *   - {"kind":"out-of-scope","reason":"...","suggestedAlternative":"..."}
 *
 * Designed to **fail open**: any network error, parse error, or unknown kind
 * resolves to {kind:"clear"} so the orchestrator continues to the normal LLM
 * turn. The cost of a false negative here (Pick proceeds without asking) is
 * far lower than blocking valid messages on a flaky classification.
 */

const SYSTEM_INSTRUCTION = `Tarea: clasificar un mensaje de un entrenador de baloncesto a su copiloto Pick.

Output: JSON estricto, exactamente una de estas formas:
- {"kind":"clear"}
- {"kind":"ambiguous","clarification":"<pregunta breve>","candidates":[{"id":"<id_del_digest>","label":"<texto>","kind":"team|session|player|bracket"}]}
- {"kind":"out-of-scope","reason":"<por qué Pick no puede>","suggestedAlternative":"<qué sí puede hacer>"}

Reglas:
- Sólo devuelve "ambiguous" si hay >1 entidad plausible en el digest y el mensaje no apunta a una claramente.
- IDs SIEMPRE de los proporcionados en el digest. Nunca inventes ids.
- "out-of-scope" sólo para temas claramente externos al baloncesto del entrenador (finanzas, contenido legal genérico, mensajería externa a apps de terceros).
- Si dudas, devuelve "clear". Bias hacia clear para no interrumpir al coach sin razón.
- No incluyas texto fuera del JSON. No uses markdown.`;

export interface LlmClassifyDeps {
  llm: SummarizerLLM;
  traceContext: TraceContext;
}

function extractText(parts: GeminiPart[]): string {
  for (const p of parts) {
    if ('text' in p && typeof p.text === 'string') return p.text;
  }
  return '';
}

function stripJsonFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function isValidAmbiguityResult(obj: unknown): obj is AmbiguityResult {
  if (!obj || typeof obj !== 'object') return false;
  const kind = (obj as { kind?: unknown }).kind;
  return kind === 'clear' || kind === 'ambiguous' || kind === 'out-of-scope';
}

function buildDigestSlim(digest: UserDigest): string {
  const teams = digest.teams.map((t) => ({ id: t.id, name: t.name }));
  const sessions = digest.upcomingSessions.map((s) => ({
    id: s.id,
    fecha: s.fecha,
    tipo: s.tipo,
    teamName: s.teamName,
    rival: s.rival,
  }));
  const brackets = digest.activeBrackets.map((b) => ({ id: b.id, name: b.name }));
  return JSON.stringify({ teams, sessions, brackets });
}

export async function llmClassifyAmbiguity(
  deps: LlmClassifyDeps,
  message: string,
  digest: UserDigest,
): Promise<AmbiguityResult> {
  try {
    const digestSlim = buildDigestSlim(digest);
    const result = await deps.llm.generateWithTools({
      systemInstruction: SYSTEM_INSTRUCTION,
      messages: [
        {
          role: 'user',
          parts: [{ text: `Mensaje: "${message}"\nDigest: ${digestSlim}` }],
        },
      ],
      tools: [],
      traceContext: deps.traceContext,
      modelHint: 'fast',
    });
    const raw = stripJsonFences(extractText(result.parts));
    if (raw.length === 0) return { kind: 'clear' };
    const parsed: unknown = JSON.parse(raw);
    return isValidAmbiguityResult(parsed) ? parsed : { kind: 'clear' };
  } catch {
    return { kind: 'clear' };
  }
}
