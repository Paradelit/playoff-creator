import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compressHistoryV2 } from '../compressHistoryV2';
import type { HistoryTurn } from '../summarizer';

const TRACE_CTX = { trace: { id: 't1' }, span: { id: 's1' } };

function mkLlm(textPerCall: string | string[] = 'chunk resumen', throws = false) {
  const responses = Array.isArray(textPerCall) ? textPerCall : [textPerCall];
  let i = 0;
  return {
    generateWithTools: vi.fn(async () => {
      if (throws) throw new Error('503');
      const text = responses[Math.min(i, responses.length - 1)];
      i += 1;
      return {
        parts: [{ text }],
        finishReason: 'STOP',
        model: 'fake',
        latencyMs: 1,
      };
    }),
  };
}

function mkNoopCache() {
  return {
    getCachedSummary: vi.fn(async () => null),
    setCachedSummary: vi.fn(async () => undefined),
  };
}

const CACHE_DEPS = { db: {} as never, appId: 'a', wsId: 'w', userId: 'u' };

let NOOP_CACHE: ReturnType<typeof mkNoopCache>;
beforeEach(() => {
  NOOP_CACHE = mkNoopCache();
});

function makeHistory(n: number): HistoryTurn[] {
  return Array.from({ length: n }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `msg ${i}`,
  }));
}

describe('compressHistoryV2', () => {
  it('returns history verbatim when length <= 6', async () => {
    const history = makeHistory(4);
    const out = await compressHistoryV2(
      {
        llm: mkLlm() as never,
        cache: NOOP_CACHE,
        cacheDeps: CACHE_DEPS,
        conversationId: 'c1',
        traceContext: TRACE_CTX as never,
      },
      history,
    );
    expect(out).toEqual(history);
  });

  it('keeps last 6 verbatim + 1 context turn when > 6', async () => {
    const history = makeHistory(10);
    const llm = mkLlm('chunk resumen');
    const out = await compressHistoryV2(
      {
        llm: llm as never,
        cache: NOOP_CACHE,
        cacheDeps: CACHE_DEPS,
        conversationId: 'c1',
        traceContext: TRACE_CTX as never,
      },
      history,
    );
    expect(out.length).toBe(7);
    expect(out[0].content).toContain('[Contexto previo]');
    expect(out[0].content).toContain('chunk resumen');
    expect(out.slice(1)).toEqual(history.slice(-6));
  });

  it('uses cached summary if available and skips the LLM call', async () => {
    const history = makeHistory(10);
    const llm = mkLlm('not used');
    const cache = {
      getCachedSummary: vi.fn(async () => 'resumen cached'),
      setCachedSummary: vi.fn(),
    };
    const out = await compressHistoryV2(
      {
        llm: llm as never,
        cache,
        cacheDeps: CACHE_DEPS,
        conversationId: 'c1',
        traceContext: TRACE_CTX as never,
      },
      history,
    );
    expect(llm.generateWithTools).not.toHaveBeenCalled();
    expect(out[0].content).toContain('resumen cached');
    expect(cache.setCachedSummary).not.toHaveBeenCalled();
  });

  it('falls back to flat lines (130 chars) when summarizer returns null', async () => {
    const history = makeHistory(10);
    // LLM throws → summarizer returns null → flat fallback
    const llm = mkLlm('ignored', true);
    const out = await compressHistoryV2(
      {
        llm: llm as never,
        cache: NOOP_CACHE,
        cacheDeps: CACHE_DEPS,
        conversationId: 'c1',
        traceContext: TRACE_CTX as never,
      },
      history,
    );
    expect(out[0].content).toMatch(/U: msg 0/);
    expect(out[0].content).toMatch(/A: msg 1/);
    // Cache should NOT receive a write because summary was null
    expect(NOOP_CACHE.setCachedSummary).not.toHaveBeenCalled();
  });

  it('persists fresh summaries to the cache for future turns', async () => {
    const history = makeHistory(10);
    const cache = {
      getCachedSummary: vi.fn(async () => null),
      setCachedSummary: vi.fn(async () => undefined),
    };
    const llm = mkLlm('resumen fresco');
    await compressHistoryV2(
      {
        llm: llm as never,
        cache,
        cacheDeps: CACHE_DEPS,
        conversationId: 'c1',
        traceContext: TRACE_CTX as never,
      },
      history,
    );
    expect(cache.setCachedSummary).toHaveBeenCalled();
    const callArgs = cache.setCachedSummary.mock.calls[0] as unknown as [unknown, string, string];
    expect(callArgs[1]).toContain('c1:');
    expect(callArgs[2]).toBe('resumen fresco');
  });

  it('groups older turns in chunks of at most 4 turns', async () => {
    // 14 turns total → 8 older (truncate keep=6) → 2 chunks of 4
    const history = makeHistory(14);
    const llm = mkLlm(['chunk 1', 'chunk 2']);
    const out = await compressHistoryV2(
      {
        llm: llm as never,
        cache: NOOP_CACHE,
        cacheDeps: CACHE_DEPS,
        conversationId: 'c1',
        traceContext: TRACE_CTX as never,
      },
      history,
    );
    expect(llm.generateWithTools).toHaveBeenCalledTimes(2);
    expect(out[0].content).toContain('chunk 1');
    expect(out[0].content).toContain('chunk 2');
  });

  it('emits an empty array when history itself is empty (no error)', async () => {
    const out = await compressHistoryV2(
      {
        llm: mkLlm() as never,
        cache: NOOP_CACHE,
        cacheDeps: CACHE_DEPS,
        conversationId: 'c1',
        traceContext: TRACE_CTX as never,
      },
      [],
    );
    expect(out).toEqual([]);
  });
});
