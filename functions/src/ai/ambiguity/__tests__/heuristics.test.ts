import { describe, it, expect } from 'vitest';
import { detectAmbiguity } from '../heuristics';
import type { UserDigest } from '../../digest/types';
import type { ScreenContextData } from '../../types';

/**
 * Minimal digest factory for ambiguity tests. We only need the fields the
 * heuristic actually inspects (teams, upcomingSessions, etc.) — everything
 * else can stay empty.
 */
function makeDigest(overrides: Partial<UserDigest> = {}): UserDigest {
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
    ...overrides,
  };
}

describe('detectAmbiguity — partido references', () => {
  it("flags 'del partido' as ambiguous when >1 upcoming partido", () => {
    const digest = makeDigest({
      upcomingSessions: [
        { id: 's1', fecha: '2026-05-16', tipo: 'partido', teamName: 'Cadete A', rival: 'Hispano' },
        { id: 's2', fecha: '2026-05-17', tipo: 'partido', teamName: 'Juniors B', rival: 'Olímpico' },
      ],
    });
    const out = detectAmbiguity('mándame la convocatoria del partido', digest, null);
    expect(out.kind).toBe('ambiguous');
    expect(out.candidates).toHaveLength(2);
    expect(out.candidates![0].kind).toBe('session');
    expect(out.candidates![0].label).toContain('Cadete A');
  });

  it('returns clear when only 1 upcoming partido (LLM can assume that one)', () => {
    const digest = makeDigest({
      upcomingSessions: [{ id: 's1', fecha: '2026-05-16', tipo: 'partido', teamName: 'Cadete A' }],
    });
    const out = detectAmbiguity('mándame la convocatoria del partido', digest, null);
    expect(out.kind).toBe('clear');
  });

  it('returns clear when zero upcoming partidos (LLM will say no info)', () => {
    const digest = makeDigest({ upcomingSessions: [] });
    const out = detectAmbiguity('mándame la convocatoria del partido', digest, null);
    expect(out.kind).toBe('clear');
  });

  it("ignores 'partido' when the phrase is 'el partido del sábado' (specific date — let LLM resolve)", () => {
    const digest = makeDigest({
      upcomingSessions: [
        { id: 's1', fecha: '2026-05-16', tipo: 'partido', teamName: 'Cadete A' },
        { id: 's2', fecha: '2026-05-17', tipo: 'partido', teamName: 'Juniors B' },
      ],
    });
    // "el partido del sábado" is specific — LLM should resolve, not us
    const out = detectAmbiguity('muéstrame el partido del sábado', digest, null);
    expect(out.kind).toBe('clear');
  });
});

describe('detectAmbiguity — team references', () => {
  it("resolves 'este equipo' via screenSemantic.referableIds when present", () => {
    const digest = makeDigest({
      teams: [
        { id: 't1', name: 'Cadete A', memberCount: 12 },
        { id: 't2', name: 'Juniors B', memberCount: 14 },
      ],
    });
    const screen: ScreenContextData = {
      screen: 'TeamDetailScreen',
      route: '/teams/t1',
      params: {},
      semantic: {
        surface: 'team-detail',
        label: 'Viendo Cadete A',
        referableIds: { 'este equipo': 't1' },
      },
    };
    const out = detectAmbiguity('muéstrame los jugadores de este equipo', digest, screen);
    expect(out.kind).toBe('clear');
  });

  it("flags 'este equipo' as ambiguous when no screen semantic + >1 team", () => {
    const digest = makeDigest({
      teams: [
        { id: 't1', name: 'Cadete A', memberCount: 12 },
        { id: 't2', name: 'Juniors B', memberCount: 14 },
      ],
    });
    const out = detectAmbiguity('muéstrame los jugadores de este equipo', digest, null);
    expect(out.kind).toBe('ambiguous');
    expect(out.candidates).toHaveLength(2);
    expect(out.candidates!.every((c) => c.kind === 'team')).toBe(true);
  });

  it("returns clear when 'este equipo' but only 1 team in workspace", () => {
    const digest = makeDigest({
      teams: [{ id: 't1', name: 'Cadete A', memberCount: 12 }],
    });
    const out = detectAmbiguity('muéstrame los jugadores de este equipo', digest, null);
    expect(out.kind).toBe('clear');
  });
});

describe('detectAmbiguity — player references', () => {
  it("resolves 'este jugador' via screenSemantic.referableIds", () => {
    const digest = makeDigest();
    const screen: ScreenContextData = {
      screen: 'PlayerDetail',
      route: '/players/p1',
      params: {},
      semantic: {
        surface: 'player-detail',
        label: 'Viendo Pablo (#4)',
        referableIds: { 'este jugador': 'p1' },
      },
    };
    const out = detectAmbiguity('cómo está este jugador', digest, screen);
    expect(out.kind).toBe('clear');
  });

  it("flags 'este jugador' as ambiguous when no screen semantic — asks for team+name", () => {
    const digest = makeDigest();
    const out = detectAmbiguity('cómo está este jugador', digest, null);
    expect(out.kind).toBe('ambiguous');
    // No candidates listed (can't enumerate all players cheaply) — just a prompt
    expect(out.clarification).toMatch(/jugador/i);
  });
});

describe('detectAmbiguity — out-of-scope topics', () => {
  it('flags balance/finanzas as out-of-scope', () => {
    const out = detectAmbiguity('dame el balance financiero del trimestre', makeDigest(), null);
    expect(out.kind).toBe('out-of-scope');
    expect(out.reason).toBeTruthy();
  });

  it('flags facturación as out-of-scope', () => {
    const out = detectAmbiguity('envíame la factura de marzo', makeDigest(), null);
    expect(out.kind).toBe('out-of-scope');
  });

  it('flags external messaging requests as out-of-scope', () => {
    const out = detectAmbiguity('mándame un email con esto', makeDigest(), null);
    expect(out.kind).toBe('out-of-scope');
  });

  it("does NOT flag basketball-domain 'mándame la convocatoria' (in-scope)", () => {
    const digest = makeDigest({
      upcomingSessions: [{ id: 's1', fecha: '2026-05-16', tipo: 'partido', teamName: 'Cadete A' }],
    });
    const out = detectAmbiguity('mándame la convocatoria', digest, null);
    expect(out.kind).not.toBe('out-of-scope');
  });
});

describe('detectAmbiguity — passthrough cases', () => {
  it('returns clear on a greeting', () => {
    const out = detectAmbiguity('hola Pick', makeDigest(), null);
    expect(out.kind).toBe('clear');
  });

  it('returns clear on a specific question with no demonstratives', () => {
    const digest = makeDigest({
      teams: [
        { id: 't1', name: 'Cadete A', memberCount: 12 },
        { id: 't2', name: 'Juniors B', memberCount: 14 },
      ],
    });
    const out = detectAmbiguity('cuántos jugadores hay en Cadete A', digest, null);
    expect(out.kind).toBe('clear');
  });
});
