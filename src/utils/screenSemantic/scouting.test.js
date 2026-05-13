import { describe, it, expect } from 'vitest';
import { buildScoutingSemantic } from './scouting';

describe('buildScoutingSemantic', () => {
  it('returns null without session', () => {
    expect(buildScoutingSemantic(null)).toBeNull();
    expect(buildScoutingSemantic({ session: null })).toBeNull();
    expect(buildScoutingSemantic({ session: {} })).toBeNull();
  });

  it('builds label with rival + fecha + team', () => {
    const semantic = buildScoutingSemantic({
      session: { id: 's1', rival: 'Hispano', fecha: '2026-05-20' },
      team: { id: 't1', teamName: 'Cadete A', categoria: 'cadete' },
    });
    expect(semantic.surface).toBe('scouting');
    expect(semantic.label).toContain('Hispano');
    expect(semantic.label).toContain('2026-05-20');
    expect(semantic.label).toContain('Cadete A');
    expect(semantic.referableIds['esta sesión']).toBe('s1');
    expect(semantic.referableIds['este scouting']).toBe('s1');
    expect(semantic.referableIds['este equipo']).toBe('t1');
  });

  it('omits team referable when team missing', () => {
    const semantic = buildScoutingSemantic({
      session: { id: 's1', rival: 'X' },
    });
    expect(semantic.referableIds['este equipo']).toBeUndefined();
  });
});
