import { describe, it, expect, vi } from 'vitest';
import { llmClassifyAmbiguity } from '../llmClassifier';
import type { UserDigest } from '../../digest/types';

function makeDigest(overrides: Partial<UserDigest> = {}): UserDigest {
  return {
    todayISO: '2026-05-13',
    todayLocalDayOfWeek: 'miércoles',
    workspace: { id: 'w1', name: 'Test', type: 'personal', userRole: 'owner' },
    teams: [
      { id: 't1', name: 'Cadete A', memberCount: 12 },
      { id: 't2', name: 'Juniors B', memberCount: 14 },
    ],
    activeBrackets: [],
    upcomingSessions: [],
    recentPastSessions: [],
    pendingActions: { convocatorias: [], scoutings: [], analyses: [], playerReports: [] },
    preferences: {},
    memories: [],
    ...overrides,
  };
}

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

const TRACE_CTX = { trace: { id: 't1' }, span: { id: 's1' } };

describe('llmClassifyAmbiguity', () => {
  it('returns clear when LLM responds with {"kind":"clear"}', async () => {
    const llm = mkLlm({ text: '{"kind":"clear"}' });
    const out = await llmClassifyAmbiguity(
      { llm: llm as never, traceContext: TRACE_CTX as never },
      'qué planeamos para el sábado',
      makeDigest(),
    );
    expect(out.kind).toBe('clear');
  });

  it('returns ambiguous with candidates when LLM detects > 1 referent', async () => {
    const llm = mkLlm({
      text: '{"kind":"ambiguous","clarification":"¿De qué equipo?","candidates":[{"id":"t1","label":"Cadete A","kind":"team"},{"id":"t2","label":"Juniors B","kind":"team"}]}',
    });
    const out = await llmClassifyAmbiguity(
      { llm: llm as never, traceContext: TRACE_CTX as never },
      'cómo está el grupo',
      makeDigest(),
    );
    expect(out.kind).toBe('ambiguous');
    expect(out.candidates).toHaveLength(2);
    expect(out.clarification).toMatch(/equipo/i);
  });

  it('returns out-of-scope when LLM flags it', async () => {
    const llm = mkLlm({
      text: '{"kind":"out-of-scope","reason":"no datos legales","suggestedAlternative":"entrenamientos y partidos"}',
    });
    const out = await llmClassifyAmbiguity(
      { llm: llm as never, traceContext: TRACE_CTX as never },
      'cuéntame de la legislación deportiva',
      makeDigest(),
    );
    expect(out.kind).toBe('out-of-scope');
    expect(out.reason).toBeTruthy();
  });

  it('fails OPEN (returns clear) when LLM throws — never blocks the flow', async () => {
    const llm = mkLlm({ throw: true });
    const out = await llmClassifyAmbiguity(
      { llm: llm as never, traceContext: TRACE_CTX as never },
      'hola',
      makeDigest(),
    );
    expect(out.kind).toBe('clear');
  });

  it('fails OPEN when LLM returns non-JSON', async () => {
    const llm = mkLlm({ text: 'no soy json' });
    const out = await llmClassifyAmbiguity(
      { llm: llm as never, traceContext: TRACE_CTX as never },
      'hola',
      makeDigest(),
    );
    expect(out.kind).toBe('clear');
  });

  it('fails OPEN when LLM returns unknown kind', async () => {
    const llm = mkLlm({ text: '{"kind":"maybe"}' });
    const out = await llmClassifyAmbiguity(
      { llm: llm as never, traceContext: TRACE_CTX as never },
      'hola',
      makeDigest(),
    );
    expect(out.kind).toBe('clear');
  });

  it('strips markdown fences from LLM output (defensive)', async () => {
    const llm = mkLlm({ text: '```json\n{"kind":"clear"}\n```' });
    const out = await llmClassifyAmbiguity(
      { llm: llm as never, traceContext: TRACE_CTX as never },
      'hola',
      makeDigest(),
    );
    expect(out.kind).toBe('clear');
  });

  it('passes modelHint=fast (cheap classification, not the capable chain)', async () => {
    const llm = mkLlm({ text: '{"kind":"clear"}' });
    await llmClassifyAmbiguity({ llm: llm as never, traceContext: TRACE_CTX as never }, 'hola', makeDigest());
    expect(llm.generateWithTools).toHaveBeenCalledWith(expect.objectContaining({ modelHint: 'fast', tools: [] }));
  });

  it('includes a digest-slim payload (teams + sessions + brackets ids/names) in the prompt', async () => {
    const llm = mkLlm({ text: '{"kind":"clear"}' });
    await llmClassifyAmbiguity(
      { llm: llm as never, traceContext: TRACE_CTX as never },
      'hola',
      makeDigest({
        upcomingSessions: [{ id: 's1', fecha: '2026-05-16', tipo: 'partido', teamName: 'Cadete A', rival: 'Hispano' }],
        activeBrackets: [{ id: 'b1', name: 'Copa Federación' }],
      }),
    );
    const args = llm.generateWithTools.mock.calls[0] as unknown as [
      { messages: Array<{ parts: Array<{ text: string }> }> },
    ];
    const promptText = args[0].messages[0].parts[0].text;
    // The LLM should see the digest entities by id so it can echo correct IDs.
    expect(promptText).toContain('t1');
    expect(promptText).toContain('Cadete A');
    expect(promptText).toContain('s1');
    expect(promptText).toContain('b1');
  });
});
