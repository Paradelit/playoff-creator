import { describe, it, expect } from 'vitest';
import { generarEncabezado } from './convocatoriaEncabezado';

describe('generarEncabezado', () => {
  const competition = {
    id: 'c1',
    nombre: 'Liga Cadete A',
    fases: [
      { id: 'f1', nombre: 'Fase 1', jornadas: 22 },
      { id: 'f2', nombre: 'Permanencia', jornadas: 7 },
    ],
  };

  it('liga par + 1ª vuelta (jornada 1-11 of 22)', () => {
    const session = { tipo: 'partido', competitionId: 'c1', faseId: 'f1', jornadaNumero: 5, rival: 'Movistar' };
    const out = generarEncabezado({ session, competition });
    expect(out).toBe('*Liga Cadete A · Fase 1 (1ª vuelta)*\n_Jornada 5 vs Movistar_');
  });

  it('liga par + 2ª vuelta (jornada 12-22 of 22)', () => {
    const session = { tipo: 'partido', competitionId: 'c1', faseId: 'f1', jornadaNumero: 15, rival: 'Movistar' };
    const out = generarEncabezado({ session, competition });
    expect(out).toBe('*Liga Cadete A · Fase 1 (2ª vuelta)*\n_Jornada 15 vs Movistar_');
  });

  it('liga impar (no vuelta) — jornadas=7', () => {
    const session = { tipo: 'partido', competitionId: 'c1', faseId: 'f2', jornadaNumero: 3, rival: 'Movistar' };
    const out = generarEncabezado({ session, competition });
    expect(out).toBe('*Liga Cadete A · Permanencia*\n_Jornada 3 vs Movistar_');
  });

  it('amistoso (no competition)', () => {
    const session = { tipo: 'partido', competitionId: null, rival: 'Movistar' };
    const out = generarEncabezado({ session, competition: null });
    expect(out).toBe('*Amistoso*\n_vs Movistar_');
  });

  it('playoff with matchTitle and gameIndex', () => {
    const session = { tipo: 'playoff', matchTitle: '1/8', gameIndex: 0, rival: 'Saltium' };
    const out = generarEncabezado({ session, competition: null });
    expect(out).toBe('*Playoffs 1/8*\n_Jornada 1 vs Saltium_');
  });

  it('playoff game 2 of 3', () => {
    const session = { tipo: 'playoff', matchTitle: 'Cuartos', gameIndex: 1, rival: 'Saltium' };
    const out = generarEncabezado({ session, competition: null });
    expect(out).toBe('*Playoffs Cuartos*\n_Jornada 2 vs Saltium_');
  });
});
