import type { HistoryCacheDeps } from './cache';
import { summarizeChunk, HistoryTurn, SummarizerLLM } from './summarizer';
import type { TraceContext } from '../types';

/**
 * Topic-aware history compression (sub-B.2).
 *
 * Replaces the previous flat-truncation approach (`compressConversationHistory`
 * in orchestratorAgent.ts) which cut every older turn to 130 chars and lost
 * narrative context. v2 instead:
 *
 *   1. Keeps the last 6 turns verbatim (RECENT_KEEP).
 *   2. Splits the older turns into chunks of CHUNK_SIZE consecutive turns.
 *   3. For each chunk, asks a *fast* LLM for a 1-2 sentence summary.
 *   4. Caches each summary by `(conversationId, chunkEndIndex)` so future
 *      turns don't re-summarize the same span.
 *   5. Falls back to flat lines if the LLM call fails — the conversation
 *      keeps working, just without the rich summary.
 *
 * The resulting "context" turn is concatenated with the verbatim recent turns
 * and returned in the shape the orchestrator already expects.
 */

const RECENT_KEEP = 6;
const CHUNK_SIZE = 4;
const FLAT_LINE_MAX = 130;

export interface CompressCacheLayer {
  getCachedSummary(deps: HistoryCacheDeps, key: string): Promise<string | null>;
  setCachedSummary(deps: HistoryCacheDeps, key: string, summary: string): Promise<void>;
}

export interface CompressDeps {
  llm: SummarizerLLM;
  cache: CompressCacheLayer;
  cacheDeps: HistoryCacheDeps;
  conversationId: string;
  traceContext: TraceContext;
}

function chunkifyOlder(older: HistoryTurn[]): HistoryTurn[][] {
  const chunks: HistoryTurn[][] = [];
  for (let i = 0; i < older.length; i += CHUNK_SIZE) {
    chunks.push(older.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

function flatLine(turn: HistoryTurn): string {
  const label = turn.role === 'user' ? 'U' : 'A';
  const excerpt = turn.content.replace(/\n/g, ' ').substring(0, FLAT_LINE_MAX);
  const suffix = turn.content.length > FLAT_LINE_MAX ? '…' : '';
  return `${label}: ${excerpt}${suffix}`;
}

export async function compressHistoryV2(deps: CompressDeps, history: HistoryTurn[]): Promise<HistoryTurn[]> {
  if (history.length <= RECENT_KEEP) return history;

  const older = history.slice(0, history.length - RECENT_KEEP);
  const recent = history.slice(history.length - RECENT_KEEP);
  const chunks = chunkifyOlder(older);

  const summaries: string[] = [];
  let chunkEndIdx = 0;
  for (const chunk of chunks) {
    chunkEndIdx += chunk.length;
    const cacheKey = `${deps.conversationId}:${chunkEndIdx}`;

    let summary = await deps.cache.getCachedSummary(deps.cacheDeps, cacheKey);
    if (summary === null) {
      summary = await summarizeChunk({ llm: deps.llm, traceContext: deps.traceContext }, chunk);
      if (summary !== null) {
        await deps.cache.setCachedSummary(deps.cacheDeps, cacheKey, summary);
      }
    }

    if (summary === null) {
      // Summarizer failed — preserve narrative as best we can with flat lines.
      summaries.push(chunk.map(flatLine).join('\n'));
    } else {
      summaries.push(summary);
    }
  }

  const numbered = summaries.map((s, i) => `${i + 1}) ${s}`).join('\n');
  const contextTurn: HistoryTurn = {
    role: 'user',
    content: `[Contexto previo]\n${numbered}`,
  };

  return [contextTurn, ...recent];
}
