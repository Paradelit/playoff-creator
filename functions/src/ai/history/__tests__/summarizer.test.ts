import { describe, it, expect, vi } from 'vitest';
import { summarizeChunk } from '../summarizer';

/**
 * Fake LLMProvider that mimics generateWithTools(). Tests pass a single text
 * response (or simulate an error) and assert how summarizeChunk reacts.
 */
function mkLlm(opts: { text?: string; throw?: boolean } = {}) {
  return {
    generateWithTools: vi.fn(async () => {
      if (opts.throw) throw new Error('503 overloaded');
      return {
        parts: [{ text: opts.text ?? '' }],
        finishReason: 'STOP',
        model: 'fake',
        latencyMs: 1,
      };
    }),
  };
}

const TURNS = [
  { role: 'user' as const, content: 'haz la convocatoria del Cadete A' },
  { role: 'assistant' as const, content: 'Hecho.' },
];

const TRACE_CTX = { trace: { id: 't1' }, span: { id: 's1' } };

describe('summarizeChunk', () => {
  it('returns trimmed text from LLM response', async () => {
    const llm = mkLlm({ text: '  Coach pidió convocatoria de Cadete A; enviada.  ' });
    const out = await summarizeChunk({ llm: llm as never, traceContext: TRACE_CTX as never }, TURNS);
    expect(out).toBe('Coach pidió convocatoria de Cadete A; enviada.');
  });

  it('calls LLM with modelHint=fast (cheap summary, not the capable chain)', async () => {
    const llm = mkLlm({ text: 'resumen' });
    await summarizeChunk({ llm: llm as never, traceContext: TRACE_CTX as never }, TURNS);
    expect(llm.generateWithTools).toHaveBeenCalledWith(expect.objectContaining({ modelHint: 'fast', tools: [] }));
  });

  it('returns null when LLM throws (caller falls back to flat lines)', async () => {
    const llm = mkLlm({ throw: true });
    const out = await summarizeChunk({ llm: llm as never, traceContext: TRACE_CTX as never }, TURNS);
    expect(out).toBeNull();
  });

  it('returns null when LLM returns empty/whitespace', async () => {
    const llm = mkLlm({ text: '   ' });
    const out = await summarizeChunk({ llm: llm as never, traceContext: TRACE_CTX as never }, TURNS);
    expect(out).toBeNull();
  });

  it('returns null on empty turns array (defensive)', async () => {
    const llm = mkLlm({ text: 'should not be called' });
    const out = await summarizeChunk({ llm: llm as never, traceContext: TRACE_CTX as never }, []);
    expect(out).toBeNull();
    expect(llm.generateWithTools).not.toHaveBeenCalled();
  });

  it('includes user/assistant labels in the prompt to preserve narrative order', async () => {
    const llm = mkLlm({ text: 'ok' });
    await summarizeChunk({ llm: llm as never, traceContext: TRACE_CTX as never }, TURNS);
    const args = llm.generateWithTools.mock.calls[0] as unknown as [
      { messages: Array<{ parts: Array<{ text: string }> }> },
    ];
    const call = args[0];
    const text = call.messages[0].parts[0].text;
    expect(text).toContain('U: haz la convocatoria del Cadete A');
    expect(text).toContain('A: Hecho.');
  });
});
