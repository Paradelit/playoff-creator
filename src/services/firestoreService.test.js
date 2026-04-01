import { describe, it, expect } from 'vitest';
import { toFirestore } from './firestoreService';

describe('toFirestore', () => {
  const baseBracket = {
    id: '123',
    name: 'Test Tournament',
    teamId: 'team-1',
    teamName: 'Alevín 1º A',
    myTeam: 'Alevín 1º A',
    isShared: true,
    isSharedRef: true,
    exportVersion: 2,
    bracketData: { rootId: 'R1-M0', state: {} },
    createdAt: 1000,
  };

  it('strips isShared, isSharedRef, exportVersion but keeps myTeam', () => {
    const result = toFirestore(baseBracket);

    expect(result.myTeam).toBe('Alevín 1º A');
    expect(result.isShared).toBeUndefined();
    expect(result.isSharedRef).toBeUndefined();
    expect(result.exportVersion).toBeUndefined();
  });

  it('preserves teamId and teamName', () => {
    const result = toFirestore(baseBracket);

    expect(result.teamId).toBe('team-1');
    expect(result.teamName).toBe('Alevín 1º A');
  });

  it('preserves core bracket data', () => {
    const result = toFirestore(baseBracket);

    expect(result.id).toBe('123');
    expect(result.name).toBe('Test Tournament');
    expect(result.bracketData).toEqual({ rootId: 'R1-M0', state: {} });
    expect(result.createdAt).toBe(1000);
  });

  it('sets myTeam to null when undefined', () => {
    const bracket = { ...baseBracket, myTeam: undefined };
    const result = toFirestore(bracket);

    expect(result.myTeam).toBeNull();
  });

  describe('forShared=true', () => {
    it('strips myTeam in addition to other fields', () => {
      const result = toFirestore(baseBracket, true);

      expect(result.myTeam).toBeUndefined();
      expect(result.isShared).toBeUndefined();
      expect(result.isSharedRef).toBeUndefined();
    });

    it('still preserves teamId and teamName', () => {
      const result = toFirestore(baseBracket, true);

      expect(result.teamId).toBe('team-1');
      expect(result.teamName).toBe('Alevín 1º A');
    });
  });
});
