import { describe, it, expect } from 'vitest';
import {
  formatCountdown,
  relativeTime,
  buildPendingActions,
  buildWeekStrip,
  buildNewsItems,
  pickNextAction,
} from './homeUtils';
import { toYMD } from './dateUtils';

function fixedDate(y, m, d, h = 0, min = 0) {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

describe('formatCountdown', () => {
  it('returns "En curso" while the session is running', () => {
    const now = fixedDate(2026, 4, 18, 10, 30);
    const session = { fecha: '2026-04-18', horaInicio: '10:00', horaFin: '11:30' };
    expect(formatCountdown(session, now)).toEqual({ label: 'En curso', urgency: 'live' });
  });

  it('returns "En N min" when less than an hour to start', () => {
    const now = fixedDate(2026, 4, 18, 9, 30);
    const session = { fecha: '2026-04-18', horaInicio: '10:00', horaFin: '11:00' };
    expect(formatCountdown(session, now)).toEqual({ label: 'En 30 min', urgency: 'soon' });
  });

  it('returns hours for same-day events more than an hour out', () => {
    const now = fixedDate(2026, 4, 18, 8, 0);
    const session = { fecha: '2026-04-18', horaInicio: '10:30', horaFin: '12:00' };
    const out = formatCountdown(session, now);
    expect(out.urgency).toBe('today');
    expect(out.label).toBe('En 2h 30m');
  });

  it('returns "Mañana" for next-day sessions', () => {
    const now = fixedDate(2026, 4, 18, 20, 0);
    const session = { fecha: '2026-04-19', horaInicio: '17:00', horaFin: '19:00' };
    expect(formatCountdown(session, now)).toEqual({ label: 'Mañana · 17:00', urgency: 'tomorrow' });
  });

  it('returns days for future events beyond tomorrow', () => {
    const now = fixedDate(2026, 4, 18, 9, 0);
    const session = { fecha: '2026-04-21', horaInicio: '18:00', horaFin: '20:00' };
    const out = formatCountdown(session, now);
    expect(out.urgency).toBe('future');
    expect(out.label).toMatch(/En \d+ días/);
  });
});

describe('relativeTime', () => {
  const now = fixedDate(2026, 4, 18, 12, 0);
  it('formats "hace N min" below an hour', () => {
    expect(relativeTime(now.getTime() - 10 * 60 * 1000, now)).toBe('hace 10 min');
  });
  it('formats hours below a day', () => {
    expect(relativeTime(now.getTime() - 3 * 60 * 60 * 1000, now)).toBe('hace 3h');
  });
  it('returns "ayer" for one day', () => {
    expect(relativeTime(now.getTime() - 25 * 60 * 60 * 1000, now)).toBe('ayer');
  });
  it('returns "ahora" below a minute', () => {
    expect(relativeTime(now.getTime() - 5 * 1000, now)).toBe('ahora');
  });
  it('handles firestore-like Timestamp objects', () => {
    const ts = { toMillis: () => now.getTime() - 2 * 60 * 60 * 1000 };
    expect(relativeTime(ts, now)).toBe('hace 2h');
  });
});

describe('buildPendingActions', () => {
  const today = fixedDate(2026, 4, 18);
  const todayYMD = toYMD(today);

  it('flags past trainings without trainingId', () => {
    const items = buildPendingActions(
      [
        { id: 'a', tipo: 'entrenamiento', fecha: '2026-04-17', teamName: 'U14' },
        { id: 'b', tipo: 'entrenamiento', fecha: '2026-04-17', teamName: 'U16', trainingId: 'tr1' },
      ],
      todayYMD,
    );
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('pending-training-a');
    expect(items[0].type).toBe('training');
  });

  it('flags playoff games without scores, once per match', () => {
    const items = buildPendingActions(
      [
        {
          id: 'p1',
          tipo: 'playoff',
          fecha: '2026-04-15',
          rival: 'Rivalón',
          bracketId: 'br1',
          bracketMatchId: 'R1-M0',
          scores: [],
        },
        {
          id: 'p2',
          tipo: 'playoff',
          fecha: '2026-04-16',
          rival: 'Rivalón',
          bracketId: 'br1',
          bracketMatchId: 'R1-M0',
          scores: [],
        },
        {
          id: 'p3',
          tipo: 'playoff',
          fecha: '2026-04-12',
          rival: 'Otro',
          bracketId: 'br1',
          bracketMatchId: 'R1-M1',
          scores: [{ s1: 50, s2: 30 }],
        },
      ],
      todayYMD,
    );
    expect(items).toHaveLength(1);
    expect(items[0].id).toMatch(/pending-playoff-/);
  });

  it('ignores future sessions', () => {
    const items = buildPendingActions(
      [
        { id: 'a', tipo: 'entrenamiento', fecha: '2026-04-19' },
        { id: 'b', tipo: 'entrenamiento', fecha: '2026-04-20' },
      ],
      todayYMD,
    );
    expect(items).toHaveLength(0);
  });
});

describe('buildWeekStrip', () => {
  it('produces 7 days starting on Monday', () => {
    const wed = fixedDate(2026, 4, 15); // Wednesday
    const strip = buildWeekStrip([], wed);
    expect(strip).toHaveLength(7);
    expect(strip[0].label).toBe('L');
    expect(strip[6].label).toBe('D');
    expect(strip[0].ymd).toBe('2026-04-13');
    expect(strip[6].ymd).toBe('2026-04-19');
  });

  it('counts sessions by type per day', () => {
    const today = fixedDate(2026, 4, 15);
    const sessions = [
      { id: '1', tipo: 'entrenamiento', fecha: '2026-04-13' },
      { id: '2', tipo: 'entrenamiento', fecha: '2026-04-13' },
      { id: '3', tipo: 'partido', fecha: '2026-04-18' },
      { id: '4', tipo: 'playoff', fecha: '2026-04-19' },
    ];
    const strip = buildWeekStrip(sessions, today);
    expect(strip[0].counts.entrenamiento).toBe(2);
    expect(strip[5].counts.partido).toBe(1);
    expect(strip[6].counts.playoff).toBe(1);
  });

  it('flags today correctly', () => {
    const today = fixedDate(2026, 4, 15);
    const strip = buildWeekStrip([], today);
    const todayCell = strip.find((d) => d.isToday);
    expect(todayCell).toBeTruthy();
    expect(todayCell.ymd).toBe('2026-04-15');
  });
});

describe('pickNextAction', () => {
  const todayYMD = '2026-04-18';
  it('returns the first future event sorted by date+time', () => {
    const pick = pickNextAction(
      [
        { id: 'a', fecha: '2026-04-20', horaInicio: '18:00' },
        { id: 'b', fecha: '2026-04-18', horaInicio: '20:00' },
        { id: 'c', fecha: '2026-04-18', horaInicio: '10:00' },
      ],
      todayYMD,
    );
    expect(pick.id).toBe('c');
  });

  it('falls back when no upcoming session', () => {
    const fallback = { id: 'fb', fecha: '2026-04-19' };
    const pick = pickNextAction([{ id: 'past', fecha: '2026-04-10' }], todayYMD, fallback);
    expect(pick).toBe(fallback);
  });

  it('returns null when empty with no fallback', () => {
    expect(pickNextAction([], todayYMD)).toBeNull();
  });
});

describe('buildNewsItems', () => {
  const now = fixedDate(2026, 4, 18, 12, 0);

  it('returns sorted items across sources', () => {
    const items = buildNewsItems({
      trainings: [
        { id: 'tr1', teamId: 't1', createdAt: now.getTime() - 60 * 60 * 1000, meta: { numero: 5, equipo: 'U14' } },
      ],
      exercises: [{ id: 'ex1', nombre: 'Balón al poste', createdAt: now.getTime() - 10 * 60 * 1000 }],
      now,
      limit: 5,
    });
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe('exercise_added');
    expect(items[1].kind).toBe('training_created');
  });

  it('respects the limit', () => {
    const trainings = Array.from({ length: 10 }, (_, i) => ({
      id: `tr${i}`,
      teamId: 't1',
      createdAt: now.getTime() - i * 60 * 1000,
      meta: { numero: i },
    }));
    const items = buildNewsItems({ trainings, now, limit: 3 });
    expect(items).toHaveLength(3);
  });
});
