import { describe, it, expect } from 'vitest';
import { buildConvocatoriaPendientes, buildCumpleañosDelDia } from './convocatoriaPendientes';

const NOW = new Date('2026-04-29T10:00:00');
const teamA = { id: 'tA', convocatoriaReminderHours: 72, teamName: 'Cadete A' };

describe('buildConvocatoriaPendientes', () => {
  it('includes session within window not yet sent', () => {
    const sessions = [
      { id: 's1', teamId: 'tA', tipo: 'partido', fecha: '2026-04-30', horaInicio: '18:00', rival: 'X' },
    ];
    const items = buildConvocatoriaPendientes(sessions, [teamA], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('convocatoria');
  });

  it('excludes already sent', () => {
    const sessions = [
      {
        id: 's1',
        teamId: 'tA',
        tipo: 'partido',
        fecha: '2026-04-30',
        horaInicio: '18:00',
        rival: 'X',
        convocatoriaSentAt: new Date(),
      },
    ];
    expect(buildConvocatoriaPendientes(sessions, [teamA], NOW)).toHaveLength(0);
  });

  it('excludes past sessions', () => {
    const sessions = [
      { id: 's1', teamId: 'tA', tipo: 'partido', fecha: '2026-04-28', horaInicio: '18:00', rival: 'X' },
    ];
    expect(buildConvocatoriaPendientes(sessions, [teamA], NOW)).toHaveLength(0);
  });

  it('excludes sessions outside reminder window', () => {
    const sessions = [
      { id: 's1', teamId: 'tA', tipo: 'partido', fecha: '2026-05-15', horaInicio: '18:00', rival: 'X' },
    ];
    expect(buildConvocatoriaPendientes(sessions, [teamA], NOW)).toHaveLength(0);
  });

  it('marks severity high when <24h', () => {
    const sessions = [
      { id: 's1', teamId: 'tA', tipo: 'partido', fecha: '2026-04-29', horaInicio: '18:00', rival: 'X' },
    ];
    const items = buildConvocatoriaPendientes(sessions, [teamA], NOW);
    expect(items[0].severity).toBe('high');
  });

  it('uses default 72h when team has no override', () => {
    const team = { id: 'tA' };
    const sessions = [
      { id: 's1', teamId: 'tA', tipo: 'partido', fecha: '2026-05-01', horaInicio: '18:00', rival: 'X' },
    ];
    expect(buildConvocatoriaPendientes(sessions, [team], NOW)).toHaveLength(1);
  });
});

describe('buildCumpleañosDelDia', () => {
  it('matches member born today', () => {
    const member = { id: 'm1', nombre: 'Pablo', fechaNacimiento: '2010-04-29', teamId: 'tA', tipo: 'jugador' };
    const items = buildCumpleañosDelDia([member], [teamA], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].severity).toBe('high');
  });

  it('matches member born tomorrow', () => {
    const member = { id: 'm1', nombre: 'Pablo', fechaNacimiento: '2010-04-30', teamId: 'tA' };
    const items = buildCumpleañosDelDia([member], [teamA], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].severity).toBe('normal');
  });

  it('skips members with no birthday', () => {
    const member = { id: 'm1', nombre: 'Pablo', teamId: 'tA' };
    expect(buildCumpleañosDelDia([member], [teamA], NOW)).toHaveLength(0);
  });

  it('29-feb falls back to 28-feb in non-leap years', () => {
    const member = { id: 'm1', nombre: 'Pablo', fechaNacimiento: '2008-02-29', teamId: 'tA' };
    const nonLeap = new Date('2026-02-28T10:00:00');
    const items = buildCumpleañosDelDia([member], [teamA], nonLeap);
    expect(items).toHaveLength(1);
  });
});
