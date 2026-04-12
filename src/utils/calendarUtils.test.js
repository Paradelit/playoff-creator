import { describe, it, expect } from 'vitest';
import { parseDateToISO, buildPlayoffSessions } from './calendarUtils';

describe('parseDateToISO', () => {
  it('returns ISO date from YYYY-MM-DD input', () => {
    expect(parseDateToISO('2025-03-15')).toBe('2025-03-15');
  });

  it('returns ISO date from YYYY-MM-DD with extra chars', () => {
    expect(parseDateToISO('2025-03-15T10:00:00')).toBe('2025-03-15');
  });

  it('converts DD/MM/YYYY to YYYY-MM-DD', () => {
    expect(parseDateToISO('15/03/2025')).toBe('2025-03-15');
  });

  it('returns null for null/undefined/empty', () => {
    expect(parseDateToISO(null)).toBe(null);
    expect(parseDateToISO(undefined)).toBe(null);
    expect(parseDateToISO('')).toBe(null);
  });

  it('returns null for unrecognized format', () => {
    expect(parseDateToISO('March 15, 2025')).toBe(null);
    expect(parseDateToISO('abc')).toBe(null);
  });

  it('returns null for non-string input', () => {
    expect(parseDateToISO(12345)).toBe(null);
  });
});

describe('buildPlayoffSessions', () => {
  const teams = [{ id: 'team-1', categoria: 'Infantil', año: '1º', genero: 'Masculino' }];

  it('returns empty array for brackets without matching team', () => {
    const brackets = [{ id: 'b1', teamId: 'team-999', bracketData: { state: {} } }];
    expect(buildPlayoffSessions(brackets, teams)).toEqual([]);
  });

  it('returns empty array for brackets without bracketData', () => {
    const brackets = [{ id: 'b1', teamId: 'team-1' }];
    expect(buildPlayoffSessions(brackets, teams)).toEqual([]);
  });

  it('returns empty array for brackets without myTeam', () => {
    const brackets = [
      {
        id: 'b1',
        teamId: 'team-1',
        bracketData: {
          state: {
            'R1-M0': { id: 'R1-M0', team1: 'A', team2: 'B', dates: ['2025-03-15'] },
          },
        },
      },
    ];
    expect(buildPlayoffSessions(brackets, teams)).toEqual([]);
  });

  it('builds sessions for matches where myTeam is involved', () => {
    const brackets = [
      {
        id: 'b1',
        teamId: 'team-1',
        myTeam: 'Mi Equipo',
        name: 'Copa Primavera',
        bracketData: {
          state: {
            'R1-M0': {
              id: 'R1-M0',
              team1: 'Mi Equipo',
              team2: 'Rival FC',
              dates: ['2025-03-15'],
              scores: [],
              gamesCount: 1,
            },
          },
        },
      },
    ];

    const result = buildPlayoffSessions(brackets, teams);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'playoff-b1-R1-M0-0',
      teamId: 'team-1',
      tipo: 'playoff',
      fecha: '2025-03-15',
      rival: 'Rival FC',
      esLocal: true,
      isPlayoff: true,
      bracketName: 'Copa Primavera',
    });
  });

  it('creates multiple sessions for multi-game matches', () => {
    const brackets = [
      {
        id: 'b1',
        teamId: 'team-1',
        myTeam: 'Mi Equipo',
        bracketData: {
          state: {
            'R1-M0': {
              id: 'R1-M0',
              team1: 'Rival',
              team2: 'Mi Equipo',
              dates: ['2025-03-15', '2025-03-22'],
              gamesCount: 2,
              scores: [],
            },
          },
        },
      },
    ];

    const result = buildPlayoffSessions(brackets, teams);
    expect(result).toHaveLength(2);
    expect(result[0].esLocal).toBe(false); // myTeam is team2
    expect(result[1].gameIndex).toBe(1);
  });

  it('skips matches without dates', () => {
    const brackets = [
      {
        id: 'b1',
        teamId: 'team-1',
        myTeam: 'Mi Equipo',
        bracketData: {
          state: {
            'R1-M0': { id: 'R1-M0', team1: 'Mi Equipo', team2: 'Rival', dates: [] },
          },
        },
      },
    ];
    expect(buildPlayoffSessions(brackets, teams)).toEqual([]);
  });
});
