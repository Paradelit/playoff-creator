import { describe, it, expect } from 'vitest';
import { computeJornadaNumero, recalcAutoJornadas } from './jornadaNumbering';

describe('computeJornadaNumero', () => {
  const sessions = [
    { id: 's1', fecha: '2026-09-15', competitionId: 'c1', faseId: 'f1' },
    { id: 's2', fecha: '2026-09-22', competitionId: 'c1', faseId: 'f1' },
    { id: 's3', fecha: '2026-09-29', competitionId: 'c1', faseId: 'f1' },
  ];

  it('returns ordinal position by date', () => {
    expect(computeJornadaNumero(sessions[0], sessions, 'c1', 'f1')).toBe(1);
    expect(computeJornadaNumero(sessions[1], sessions, 'c1', 'f1')).toBe(2);
    expect(computeJornadaNumero(sessions[2], sessions, 'c1', 'f1')).toBe(3);
  });

  it('returns 1 for an empty list (new session)', () => {
    expect(computeJornadaNumero({ id: 'new', fecha: '2026-10-01' }, [], 'c1', 'f1')).toBe(1);
  });

  it('handles a new session inserted in middle', () => {
    const newSession = { id: 'sNew', fecha: '2026-09-20', competitionId: 'c1', faseId: 'f1' };
    expect(computeJornadaNumero(newSession, [...sessions, newSession], 'c1', 'f1')).toBe(2);
  });

  it('skips manually-numbered sessions when computing', () => {
    const sessionsWithManual = [
      { id: 's1', fecha: '2026-09-15', competitionId: 'c1', faseId: 'f1' },
      {
        id: 'sManual',
        fecha: '2026-09-22',
        competitionId: 'c1',
        faseId: 'f1',
        jornadaNumero: 99,
        jornadaNumeroManual: true,
      },
      { id: 's3', fecha: '2026-09-29', competitionId: 'c1', faseId: 'f1' },
    ];
    expect(computeJornadaNumero(sessionsWithManual[0], sessionsWithManual, 'c1', 'f1')).toBe(1);
    expect(computeJornadaNumero(sessionsWithManual[2], sessionsWithManual, 'c1', 'f1')).toBe(2);
  });
});

describe('recalcAutoJornadas', () => {
  it('returns updated sessions list with renumbered jornadas', () => {
    const list = [
      { id: 's1', fecha: '2026-09-15', competitionId: 'c1', faseId: 'f1' },
      { id: 's2', fecha: '2026-09-22', competitionId: 'c1', faseId: 'f1' },
    ];
    const result = recalcAutoJornadas(list, 'c1', 'f1');
    expect(result.find((s) => s.id === 's1').jornadaNumero).toBe(1);
    expect(result.find((s) => s.id === 's2').jornadaNumero).toBe(2);
  });

  it('respects manually-numbered sessions', () => {
    const list = [
      { id: 's1', fecha: '2026-09-15', competitionId: 'c1', faseId: 'f1', jornadaNumero: 5, jornadaNumeroManual: true },
      { id: 's2', fecha: '2026-09-22', competitionId: 'c1', faseId: 'f1' },
    ];
    const result = recalcAutoJornadas(list, 'c1', 'f1');
    expect(result.find((s) => s.id === 's1').jornadaNumero).toBe(5);
    expect(result.find((s) => s.id === 's2').jornadaNumero).toBe(1);
  });
});
