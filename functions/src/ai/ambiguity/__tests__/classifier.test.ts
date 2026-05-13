import { describe, it, expect } from 'vitest';
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

describe('classifyAmbiguity', () => {
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

  // B.4 will wire an LLM fallback for clear-but-still-ambiguous cases. The
  // entrypoint already accepts an `llm` dep — leaving the contract stable now
  // means B.4 is a non-breaking add.
  it('accepts an optional llm dep without using it in the regex-only build', async () => {
    const llmCalled: string[] = [];
    const llm = {
      generateWithTools: async () => {
        llmCalled.push('called');
        return { parts: [{ text: '' }], finishReason: 'STOP', model: 'fake', latencyMs: 1 };
      },
    } as never;
    const out = await classifyAmbiguity({ llm }, 'hola', makeDigest(), null);
    expect(out.kind).toBe('clear');
    expect(llmCalled).toHaveLength(0);
  });
});
