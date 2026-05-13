import { describe, it, expect } from 'vitest';
import { buildInformeJugadoresSemantic } from './informeJugadores';

describe('buildInformeJugadoresSemantic', () => {
  it('returns null when team missing', () => {
    expect(buildInformeJugadoresSemantic(null)).toBeNull();
    expect(buildInformeJugadoresSemantic({ team: null })).toBeNull();
    expect(buildInformeJugadoresSemantic({ team: {} })).toBeNull();
  });

  it('builds label with team name', () => {
    const semantic = buildInformeJugadoresSemantic({
      team: { id: 't1', teamName: 'Juniors B', categoria: 'junior' },
    });
    expect(semantic.surface).toBe('cuaderno-informe-jugadores');
    expect(semantic.label).toContain('Juniors B');
    expect(semantic.label).toContain('junior');
  });

  it('includes rowCount when > 0', () => {
    const semantic = buildInformeJugadoresSemantic({
      team: { id: 't1', teamName: 'X' },
      rowCount: 12,
    });
    expect(semantic.label).toContain('12 filas');
  });

  it('omits rowCount when 0', () => {
    const semantic = buildInformeJugadoresSemantic({
      team: { id: 't1', teamName: 'X' },
      rowCount: 0,
    });
    expect(semantic.label).not.toContain('filas');
  });

  it('exposes "este equipo" and "este informe" referableIds', () => {
    const semantic = buildInformeJugadoresSemantic({
      team: { id: 't1', teamName: 'X' },
    });
    expect(semantic.referableIds['este equipo']).toBe('t1');
    expect(semantic.referableIds['este informe']).toBe('t1');
  });
});
