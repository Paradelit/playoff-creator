import { describe, it, expect } from 'vitest';
import { buildAsistenciaSemantic } from './asistencia';

describe('buildAsistenciaSemantic', () => {
  it('returns null when team is missing', () => {
    expect(buildAsistenciaSemantic(null)).toBeNull();
    expect(buildAsistenciaSemantic({ team: null })).toBeNull();
    expect(buildAsistenciaSemantic({ team: {} })).toBeNull();
  });

  it('builds label with team name + jugadores count', () => {
    const semantic = buildAsistenciaSemantic({
      team: { id: 't1', teamName: 'Cadete A', categoria: 'cadete' },
      members: [
        { id: 'p1', tipo: 'jugador' },
        { id: 'p2', tipo: 'jugador' },
        { id: 's1', tipo: 'staff' },
      ],
    });
    expect(semantic.surface).toBe('cuaderno-asistencia');
    expect(semantic.label).toContain('Cadete A');
    expect(semantic.label).toContain('cadete');
    expect(semantic.label).toContain('2 jugadores');
    expect(semantic.referableIds['este equipo']).toBe('t1');
  });

  it('includes activeMonth when present', () => {
    const semantic = buildAsistenciaSemantic({
      team: { id: 't1', teamName: 'X' },
      members: [],
      activeMonth: '2026-05',
    });
    expect(semantic.label).toContain('2026-05');
  });

  it('omits month when not present', () => {
    const semantic = buildAsistenciaSemantic({
      team: { id: 't1', teamName: 'X' },
      members: [],
    });
    expect(semantic.label).not.toContain('Mes activo');
  });
});
