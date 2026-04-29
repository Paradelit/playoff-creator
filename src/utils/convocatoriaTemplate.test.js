import { describe, it, expect } from 'vitest';
import { DEFAULT_TEMPLATE, renderConvocatoria } from './convocatoriaTemplate';

describe('renderConvocatoria — liga visitante', () => {
  const team = {
    id: 't1',
    categoria: 'Cadete',
    citaOffsetMinutos: 45,
  };
  const competition = {
    id: 'c1',
    nombre: 'Liga Cadete A',
    fases: [{ id: 'f1', nombre: 'Fase 1', jornadas: 22 }],
  };
  const session = {
    tipo: 'partido',
    fecha: '2026-04-30',
    horaInicio: '09:30',
    rival: 'Movistar Estudiantes',
    lugar: 'Pabellón Ramiro de Maeztu',
    lugarMapsUrl: 'https://maps.app.goo.gl/Sc93PwU8kxUgzKty8',
    esLocal: false,
    competitionId: 'c1',
    faseId: 'f1',
    jornadaNumero: 15,
    notaExtra: '',
  };

  it('renders the full message with default template', () => {
    const now = new Date('2026-04-29T22:00:00');
    const { mensaje } = renderConvocatoria({ session, team, competition, now });
    expect(mensaje).toContain('Buenas noches');
    expect(mensaje).toContain('*Liga Cadete A — Fase 1 (2ª vuelta)*');
    expect(mensaje).toContain('_Jornada 15 vs Movistar Estudiantes_');
    expect(mensaje).toContain('mañana a las 09:30');
    expect(mensaje).toContain('Pabellón Ramiro de Maeztu');
    expect(mensaje).toContain('https://maps.app.goo.gl/Sc93PwU8kxUgzKty8');
    expect(mensaje).toContain('Quedamos allí a las 08:45');
  });

  it('elides notaExtra line when empty', () => {
    const now = new Date('2026-04-29T22:00:00');
    const { mensaje } = renderConvocatoria({ session, team, competition, now });
    expect(mensaje).not.toMatch(/\n\n\n/); // no triple newline
  });

  it('keeps notaExtra line when provided', () => {
    const now = new Date('2026-04-29T22:00:00');
    const { mensaje } = renderConvocatoria({
      session: { ...session, notaExtra: 'Importante llevar ambas equipaciones.' },
      team,
      competition,
      now,
    });
    expect(mensaje).toContain('Importante llevar ambas equipaciones.');
  });
});

describe('renderConvocatoria — local omits URL', () => {
  it('does not include lugarMapsUrl when esLocal=true', () => {
    const team = { id: 't1', citaOffsetMinutos: 45 };
    const session = {
      tipo: 'partido',
      fecha: '2026-04-30',
      horaInicio: '18:30',
      rival: 'Saltium',
      lugar: 'Nuestro pabellón',
      lugarMapsUrl: 'https://maps.app.goo.gl/abc',
      esLocal: true,
      competitionId: null,
    };
    const now = new Date('2026-04-29T15:00:00');
    const { mensaje } = renderConvocatoria({ session, team, competition: null, now });
    expect(mensaje).not.toContain('https://maps.app.goo.gl');
    expect(mensaje).toContain('en el pabellón');
  });
});

describe('renderConvocatoria — hora cita override', () => {
  it('uses session.horaCita when set, ignoring offset', () => {
    const team = { id: 't1', citaOffsetMinutos: 45 };
    const session = {
      tipo: 'partido',
      fecha: '2026-04-30',
      horaInicio: '18:30',
      rival: 'X',
      lugar: 'X',
      esLocal: true,
      horaCita: '17:30',
    };
    const now = new Date('2026-04-29T15:00:00');
    const { mensaje } = renderConvocatoria({ session, team, competition: null, now });
    expect(mensaje).toContain('17:30');
  });

  it('computes from offset when horaCita not set', () => {
    const team = { id: 't1', citaOffsetMinutos: 60 };
    const session = {
      tipo: 'partido',
      fecha: '2026-04-30',
      horaInicio: '18:30',
      rival: 'X',
      lugar: 'X',
      esLocal: true,
    };
    const now = new Date('2026-04-29T15:00:00');
    const { mensaje } = renderConvocatoria({ session, team, competition: null, now });
    expect(mensaje).toContain('17:30');
  });
});

describe('renderConvocatoria — custom template', () => {
  it('uses team.plantillaConvocatoria when provided', () => {
    const team = { id: 't1', citaOffsetMinutos: 45, plantillaConvocatoria: 'Hola.\n{ENCABEZADO}\nFin.' };
    const session = {
      tipo: 'partido',
      fecha: '2026-04-30',
      horaInicio: '18:30',
      rival: 'Saltium',
      lugar: 'X',
      esLocal: true,
      competitionId: null,
    };
    const now = new Date('2026-04-29T22:00:00');
    const { mensaje } = renderConvocatoria({ session, team, competition: null, now });
    expect(mensaje.startsWith('Hola.')).toBe(true);
    expect(mensaje.endsWith('Fin.')).toBe(true);
  });
});

describe('DEFAULT_TEMPLATE', () => {
  it('is a non-empty string', () => {
    expect(typeof DEFAULT_TEMPLATE).toBe('string');
    expect(DEFAULT_TEMPLATE.length).toBeGreaterThan(0);
  });
});
