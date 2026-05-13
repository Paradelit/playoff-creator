import { describe, it, expect } from 'vitest';
import { prioritizeProactive } from '../priorizer';
import type { UserDigest, PendingConvocatoria, PendingMatchAction, PendingPlayerReportsTeam } from '../../digest/types';

const NOW_ISO = '2026-05-13T18:00:00Z'; // miércoles tarde

function hoursBetween(fechaISO: string, nowISO: string): number {
  const target = new Date(fechaISO.slice(0, 10) + 'T00:00:00Z').getTime();
  return (target - new Date(nowISO).getTime()) / (60 * 60 * 1000);
}

function makeConvocatoria(o: {
  sessionId: string;
  fecha: string;
  teamName?: string;
  rival?: string;
  severity?: 'high' | 'normal';
}): PendingConvocatoria {
  const h = hoursBetween(o.fecha, NOW_ISO);
  return {
    sessionId: o.sessionId,
    fecha: o.fecha,
    teamName: o.teamName,
    rival: o.rival,
    severity: o.severity ?? (h < 48 ? 'high' : 'normal'),
    hoursUntil: h,
  };
}

function makeMatchAction(o: {
  sessionId: string;
  fecha: string;
  teamName?: string;
  rival?: string;
}): PendingMatchAction {
  return { sessionId: o.sessionId, fecha: o.fecha, teamName: o.teamName, rival: o.rival };
}

function makePlayerReportsTeam(o: {
  teamId: string;
  teamName: string;
  missingForPlayerCount: number;
}): PendingPlayerReportsTeam {
  return {
    teamId: o.teamId,
    teamName: o.teamName,
    missingForPlayerCount: o.missingForPlayerCount,
    missingPlayerNames: [],
  };
}

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

describe('prioritizeProactive', () => {
  it('returns empty list when no pendings', () => {
    const out = prioritizeProactive(makeDigest(), NOW_ISO);
    expect(out).toEqual([]);
  });

  it('emits high severity for convocatoria <48h ahead', () => {
    const digest = makeDigest({
      pendingActions: {
        convocatorias: [
          makeConvocatoria({ sessionId: 's1', fecha: '2026-05-14', teamName: 'Cadete A', rival: 'Hispano' }),
        ],
        scoutings: [],
        analyses: [],
        playerReports: [],
      },
    });
    const out = prioritizeProactive(digest, NOW_ISO);
    expect(out[0].kind).toBe('convocatoria_urgent');
    expect(out[0].severity).toBe('high');
    expect(out[0].text).toMatch(/Cadete A/);
    expect(out[0].text).toMatch(/Hispano/);
    expect(out[0].contextRefs?.sessionId).toBe('s1');
    expect(out[0].suggestedPrompt).toMatch(/convocatoria/i);
  });

  it('downgrades convocatoria to warn when >48h but <=7d', () => {
    const digest = makeDigest({
      pendingActions: {
        convocatorias: [
          makeConvocatoria({
            sessionId: 's1',
            fecha: '2026-05-17',
            teamName: 'Cadete A',
            rival: 'Hispano',
            severity: 'normal',
          }),
        ],
        scoutings: [],
        analyses: [],
        playerReports: [],
      },
    });
    const out = prioritizeProactive(digest, NOW_ISO);
    expect(out[0].severity).toBe('warn');
  });

  it('skips convocatoria for partidos in the past (defensive — should have been filtered upstream)', () => {
    const digest = makeDigest({
      pendingActions: {
        convocatorias: [makeConvocatoria({ sessionId: 's1', fecha: '2026-05-10', teamName: 'Cadete A' })],
        scoutings: [],
        analyses: [],
        playerReports: [],
      },
    });
    const out = prioritizeProactive(digest, NOW_ISO);
    expect(out.find((m) => m.kind === 'convocatoria_urgent')).toBeUndefined();
  });

  it('emits warn for analyses >7d overdue', () => {
    const digest = makeDigest({
      pendingActions: {
        convocatorias: [],
        scoutings: [],
        analyses: [
          makeMatchAction({ sessionId: 's2', fecha: '2026-04-30', teamName: 'Juniors B', rival: 'Olímpico' }),
          makeMatchAction({ sessionId: 's3', fecha: '2026-05-09', teamName: 'Cadete A', rival: 'Hispano' }), // 4d — no
        ],
        playerReports: [],
      },
    });
    const out = prioritizeProactive(digest, NOW_ISO);
    const a = out.find((m) => m.kind === 'analysis_overdue');
    expect(a).toBeDefined();
    expect(a!.severity).toBe('warn');
    expect(a!.text).toMatch(/Juniors B/);
    expect(a!.contextRefs?.sessionId).toBe('s2');
  });

  it('emits info for scouting pendiente', () => {
    const digest = makeDigest({
      pendingActions: {
        convocatorias: [],
        scoutings: [
          makeMatchAction({ sessionId: 's4', fecha: '2026-05-20', teamName: 'Cadete A', rival: 'Estudiantes' }),
        ],
        analyses: [],
        playerReports: [],
      },
    });
    const out = prioritizeProactive(digest, NOW_ISO);
    const s = out.find((m) => m.kind === 'scouting_missing');
    expect(s).toBeDefined();
    expect(s!.severity).toBe('info');
    expect(s!.text).toMatch(/Estudiantes/);
  });

  it('emits info for player reports pendientes (only when count >= 3, avoid noise)', () => {
    const digestQuiet = makeDigest({
      pendingActions: {
        convocatorias: [],
        scoutings: [],
        analyses: [],
        playerReports: [makePlayerReportsTeam({ teamId: 't1', teamName: 'Cadete A', missingForPlayerCount: 2 })],
      },
    });
    expect(prioritizeProactive(digestQuiet, NOW_ISO).find((m) => m.kind === 'player_report_missing')).toBeUndefined();

    const digestNoisy = makeDigest({
      pendingActions: {
        convocatorias: [],
        scoutings: [],
        analyses: [],
        playerReports: [makePlayerReportsTeam({ teamId: 't1', teamName: 'Cadete A', missingForPlayerCount: 8 })],
      },
    });
    const out = prioritizeProactive(digestNoisy, NOW_ISO);
    const p = out.find((m) => m.kind === 'player_report_missing');
    expect(p).toBeDefined();
    expect(p!.severity).toBe('info');
    expect(p!.text).toMatch(/Cadete A/);
    expect(p!.text).toMatch(/8/);
  });

  it('sorts by severity (high > warn > info) — most important first', () => {
    const digest = makeDigest({
      pendingActions: {
        convocatorias: [makeConvocatoria({ sessionId: 's1', fecha: '2026-05-14', teamName: 'Cadete A' })], // high
        scoutings: [makeMatchAction({ sessionId: 's2', fecha: '2026-05-20', teamName: 'Cadete A', rival: 'X' })], // info
        analyses: [makeMatchAction({ sessionId: 's3', fecha: '2026-04-25', teamName: 'Cadete A' })], // warn
        playerReports: [],
      },
    });
    const out = prioritizeProactive(digest, NOW_ISO);
    expect(out.map((m) => m.severity)).toEqual(['high', 'warn', 'info']);
  });

  it('returns multiple messages from the same kind (caller picks first un-dismissed)', () => {
    const digest = makeDigest({
      pendingActions: {
        convocatorias: [
          makeConvocatoria({ sessionId: 's1', fecha: '2026-05-14', teamName: 'Cadete A' }),
          makeConvocatoria({ sessionId: 's2', fecha: '2026-05-15', teamName: 'Juniors B' }),
        ],
        scoutings: [],
        analyses: [],
        playerReports: [],
      },
    });
    const out = prioritizeProactive(digest, NOW_ISO);
    const convocatorias = out.filter((m) => m.kind === 'convocatoria_urgent');
    expect(convocatorias).toHaveLength(2);
  });
});
