import { describe, it, expect } from 'vitest';
import { buildDynamicBracket, calculateMatchWinner } from './bracketEngine';

describe('buildDynamicBracket', () => {
  it('builds a bracket with 2 teams (1 match = final)', () => {
    const matches = [{ team1: 'A', team2: 'B' }];
    const { state, rootId } = buildDynamicBracket(matches);

    expect(rootId).toBe('R1-M0');
    expect(Object.keys(state)).toHaveLength(1);
    expect(state['R1-M0'].team1).toBe('A');
    expect(state['R1-M0'].team2).toBe('B');
    expect(state['R1-M0'].round).toBe(1);
  });

  it('builds a bracket with 4 teams (2 semis + 1 final)', () => {
    const matches = [
      { team1: 'A', team2: 'B' },
      { team1: 'C', team2: 'D' },
    ];
    const { state, rootId } = buildDynamicBracket(matches);

    expect(Object.keys(state)).toHaveLength(3);
    expect(rootId).toBe('R2-M0');

    // Final has no teams yet (populated by winners)
    const final = state['R2-M0'];
    expect(final.team1).toBeNull();
    expect(final.team2).toBeNull();
    expect(final.children).toEqual(['R1-M0', 'R1-M1']);

    // Semis link to final
    expect(state['R1-M0'].nextId).toBe('R2-M0');
    expect(state['R1-M0'].slot).toBe('team1');
    expect(state['R1-M1'].nextId).toBe('R2-M0');
    expect(state['R1-M1'].slot).toBe('team2');
  });

  it('builds a bracket with 8 teams (4 quarters + 2 semis + 1 final)', () => {
    const matches = Array.from({ length: 4 }, (_, i) => ({
      team1: `T${i * 2 + 1}`,
      team2: `T${i * 2 + 2}`,
    }));
    const { state, rootId } = buildDynamicBracket(matches);

    // 4 + 2 + 1 = 7 matches
    expect(Object.keys(state)).toHaveLength(7);
    expect(state[rootId].round).toBe(3);
    expect(state[rootId].title).toBe('FINAL');
  });

  it('applies roundsData format to each round', () => {
    const matches = [
      { team1: 'A', team2: 'B' },
      { team1: 'C', team2: 'D' },
    ];
    const roundsData = [
      { format: 'Mejor de 3', gamesCount: 3, dates: ['2024-01-01'] },
      { format: 'Partido único', gamesCount: 1, dates: ['2024-01-15'] },
    ];
    const { state } = buildDynamicBracket(matches, roundsData);

    expect(state['R1-M0'].format).toBe('Mejor de 3');
    expect(state['R1-M0'].gamesCount).toBe(3);
    expect(state['R1-M0'].scores).toHaveLength(3);

    expect(state['R2-M0'].format).toBe('Partido único');
    expect(state['R2-M0'].gamesCount).toBe(1);
    expect(state['R2-M0'].scores).toHaveLength(1);
  });

  it('preserves team1Options and team2Options', () => {
    const matches = [{ team1: null, team2: null, team1Options: ['X', 'Y'], team2Options: ['Z'] }];
    const { state } = buildDynamicBracket(matches);

    expect(state['R1-M0'].team1Options).toEqual(['X', 'Y']);
    expect(state['R1-M0'].team2Options).toEqual(['Z']);
  });
});

describe('calculateMatchWinner', () => {
  const makeMatch = (overrides) => ({
    team1: 'A',
    team2: 'B',
    gamesCount: 1,
    scores: [{ s1: '', s2: '' }],
    ...overrides,
  });

  describe('single game (gamesCount=1)', () => {
    it('returns team1 when team1 score is higher', () => {
      const match = makeMatch({ scores: [{ s1: '75', s2: '60' }] });
      expect(calculateMatchWinner(match)).toBe('A');
    });

    it('returns team2 when team2 score is higher', () => {
      const match = makeMatch({ scores: [{ s1: '60', s2: '75' }] });
      expect(calculateMatchWinner(match)).toBe('B');
    });

    it('returns null on a tie', () => {
      const match = makeMatch({ scores: [{ s1: '70', s2: '70' }] });
      expect(calculateMatchWinner(match)).toBeNull();
    });

    it('returns null when scores are empty', () => {
      const match = makeMatch({ scores: [{ s1: '', s2: '' }] });
      expect(calculateMatchWinner(match)).toBeNull();
    });
  });

  describe('best of 2 (gamesCount=2)', () => {
    it('returns team1 when aggregate is higher', () => {
      const match = makeMatch({
        gamesCount: 2,
        scores: [
          { s1: '70', s2: '65' },
          { s1: '60', s2: '68' },
        ],
      });
      // total: 130 vs 133 → B wins
      expect(calculateMatchWinner(match)).toBe('B');
    });

    it('returns null when only 1 game played', () => {
      const match = makeMatch({
        gamesCount: 2,
        scores: [
          { s1: '70', s2: '65' },
          { s1: '', s2: '' },
        ],
      });
      expect(calculateMatchWinner(match)).toBeNull();
    });

    it('returns null on aggregate tie', () => {
      const match = makeMatch({
        gamesCount: 2,
        scores: [
          { s1: '70', s2: '65' },
          { s1: '65', s2: '70' },
        ],
      });
      expect(calculateMatchWinner(match)).toBeNull();
    });
  });

  describe('best of 3 (gamesCount=3)', () => {
    it('returns team1 when they win 2 games', () => {
      const match = makeMatch({
        gamesCount: 3,
        scores: [
          { s1: '75', s2: '60' },
          { s1: '80', s2: '70' },
          { s1: '', s2: '' },
        ],
      });
      expect(calculateMatchWinner(match)).toBe('A');
    });

    it('returns team2 when they win 2 games', () => {
      const match = makeMatch({
        gamesCount: 3,
        scores: [
          { s1: '60', s2: '75' },
          { s1: '70', s2: '80' },
          { s1: '', s2: '' },
        ],
      });
      expect(calculateMatchWinner(match)).toBe('B');
    });

    it('returns null when only 1 game won by each', () => {
      const match = makeMatch({
        gamesCount: 3,
        scores: [
          { s1: '75', s2: '60' },
          { s1: '60', s2: '75' },
          { s1: '', s2: '' },
        ],
      });
      expect(calculateMatchWinner(match)).toBeNull();
    });
  });
});
