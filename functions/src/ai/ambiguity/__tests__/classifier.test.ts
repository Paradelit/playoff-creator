import { describe, it, expect, vi } from 'vitest';
import { classifyAmbiguity } from '../classifier';
import type { UserDigest } from '../../digest/types';

function makeDigest(): UserDigest {
  return {
    todayISO: '2026-05-13',
    todayLocalDayOfWeek: 'miércoles',
    workspace: { id: 'w1', name: 'Test', type: 'personal', userRole: 'owner' },
    teams: [],
    activeBrackets: [],
    upcomingSessions: [],
    recentPastSessions: [],
    pendingActions: { convocatorias: [], scoutings: [], analyses: [], playerReports: [] },
    preferences: {},
    memories: [],
  };
}

const TRACE_CTX = { trace: { id: 't1' }, span: { id: 's1' } };

function mkLlm(text = '{"kind":"clear"}') {
  return {
    generateWithTools: vi.fn(async () => ({
      parts: [{ text }],
      finishReason: 'STOP',
      model: 'fake',
      latencyMs: 1,
    })),
  };
}

describe('classifyAmbiguity — heuristics-only path', () => {
  it('returns clear for unambiguous messages', async () => {
    const out = await classifyAmbiguity({}, 'hola', makeDigest(), null);
    expect(out.kind).toBe('clear');
  });

  it('delegates to heuristics for ambiguous patterns', async () => {
    const digest: UserDigest = {
      ...makeDigest(),
      upcomingSessions: [
        { id: 's1', fecha: '2026-05-16', tipo: 'partido', teamName: 'Cadete A' },
        { id: 's2', fecha: '2026-05-17', tipo: 'partido', teamName: 'Juniors B' },
      ],
    };
    const out = await classifyAmbiguity({}, 'mándame la convocatoria del partido', digest, null);
    expect(out.kind).toBe('ambiguous');
    expect(out.candidates).toHaveLength(2);
  });

  it('returns out-of-scope for finance topics', async () => {
    const out = await classifyAmbiguity({}, 'dame el balance', makeDigest(), null);
    expect(out.kind).toBe('out-of-scope');
  });
});

describe('classifyAmbiguity — LLM fallback (sub-B.4)', () => {
  it('does NOT call LLM when llm dep is absent', async () => {
    const llm = mkLlm();
    await classifyAmbiguity({}, 'cómo va el grupo este año', makeDigest(), null);
    expect(llm.generateWithTools).not.toHaveBeenCalled();
  });

  it('does NOT call LLM when traceContext missing (defensive)', async () => {
    const llm = mkLlm();
    await classifyAmbiguity({ llm: llm as never }, 'cómo va el grupo este año', makeDigest(), null);
    expect(llm.generateWithTools).not.toHaveBeenCalled();
  });

  it('does NOT call LLM when heuristicsOnly: true', async () => {
    const llm = mkLlm();
    await classifyAmbiguity(
      { llm: llm as never, traceContext: TRACE_CTX as never, heuristicsOnly: true },
      'cómo va el grupo este año',
      makeDigest(),
      null,
    );
    expect(llm.generateWithTools).not.toHaveBeenCalled();
  });

  it('does NOT call LLM for short greetings (< 10 chars) by default', async () => {
    const llm = mkLlm();
    await classifyAmbiguity({ llm: llm as never, traceContext: TRACE_CTX as never }, 'hola', makeDigest(), null);
    expect(llm.generateWithTools).not.toHaveBeenCalled();
  });

  it('DOES call LLM for >= 10-char messages when regex says clear + llm provided', async () => {
    const llm = mkLlm('{"kind":"clear"}');
    await classifyAmbiguity(
      { llm: llm as never, traceContext: TRACE_CTX as never },
      'cómo va el grupo este año',
      makeDigest(),
      null,
    );
    expect(llm.generateWithTools).toHaveBeenCalledTimes(1);
  });

  it('does NOT call LLM when regex already returned ambiguous (heuristic wins)', async () => {
    const llm = mkLlm();
    const digest: UserDigest = {
      ...makeDigest(),
      upcomingSessions: [
        { id: 's1', fecha: '2026-05-16', tipo: 'partido', teamName: 'Cadete A' },
        { id: 's2', fecha: '2026-05-17', tipo: 'partido', teamName: 'Juniors B' },
      ],
    };
    const out = await classifyAmbiguity(
      { llm: llm as never, traceContext: TRACE_CTX as never },
      'mándame la convocatoria del partido',
      digest,
      null,
    );
    expect(out.kind).toBe('ambiguous');
    expect(llm.generateWithTools).not.toHaveBeenCalled();
  });

  it('returns the LLM verdict when it flags ambiguous', async () => {
    const llm = mkLlm(
      '{"kind":"ambiguous","clarification":"¿Cuál?","candidates":[{"id":"t1","label":"Cadete A","kind":"team"}]}',
    );
    const out = await classifyAmbiguity(
      { llm: llm as never, traceContext: TRACE_CTX as never },
      'cómo va el grupo este año',
      makeDigest(),
      null,
    );
    expect(out.kind).toBe('ambiguous');
    expect(out.candidates).toHaveLength(1);
  });
});
