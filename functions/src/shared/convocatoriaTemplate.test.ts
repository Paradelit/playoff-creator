import { describe, it, expect } from 'vitest';
import { renderConvocatoria } from './convocatoriaTemplate';

describe('renderConvocatoria (TS port)', () => {
  it('renders liga visitante with default template', () => {
    const out = renderConvocatoria({
      session: {
        tipo: 'partido',
        fecha: '2026-04-30',
        horaInicio: '09:30',
        rival: 'Movistar',
        lugar: 'Ramiro de Maeztu',
        lugarMapsUrl: 'https://maps.app.goo.gl/x',
        esLocal: false,
        competitionId: 'c1',
        faseId: 'f1',
        jornadaNumero: 15,
      },
      team: { id: 't1', citaOffsetMinutos: 45 },
      competition: { id: 'c1', nombre: 'Liga', fases: [{ id: 'f1', nombre: 'Fase 1', jornadas: 22 }] },
      now: new Date('2026-04-29T22:00:00'),
    });
    expect(out.mensaje).toContain('Buenas noches');
    expect(out.mensaje).toContain('Liga — Fase 1 (2ª vuelta)');
    expect(out.mensaje).toContain('mañana a las 09:30');
    expect(out.mensaje).toContain('08:45');
    expect(out.mensaje).toContain('https://maps.app.goo.gl/x');
    expect(out.encabezado).toContain('Jornada 15 vs Movistar');
  });

  it('renders amistoso local without URL', () => {
    const out = renderConvocatoria({
      session: {
        tipo: 'partido',
        fecha: '2026-04-30',
        horaInicio: '18:00',
        rival: 'Saltium',
        lugar: 'Casa',
        esLocal: true,
        competitionId: null,
      },
      team: { id: 't1', citaOffsetMinutos: 30 },
      competition: null,
      now: new Date('2026-04-29T10:00:00'),
    });
    expect(out.mensaje).toContain('Amistoso');
    expect(out.mensaje).not.toContain('http');
    expect(out.mensaje).toContain('en el pabellón');
  });
});
