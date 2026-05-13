import { describe, it, expect } from 'vitest';
import { buildCalendarSemantic } from './calendar';

describe('buildCalendarSemantic', () => {
  it('returns null when state is missing', () => {
    expect(buildCalendarSemantic(null)).toBeNull();
    expect(buildCalendarSemantic({ currentDate: null, viewMode: 'month' })).toBeNull();
    expect(buildCalendarSemantic({ currentDate: new Date(), viewMode: null })).toBeNull();
  });

  it('month view label includes month name + year', () => {
    const semantic = buildCalendarSemantic({
      currentDate: new Date(2026, 4, 15), // mayo
      viewMode: 'month',
      visibleSessions: [],
    });
    expect(semantic.surface).toBe('calendar');
    expect(semantic.label).toContain('vista mensual');
    expect(semantic.label).toContain('mayo 2026');
  });

  it('week view label includes Monday-Sunday range', () => {
    const semantic = buildCalendarSemantic({
      currentDate: new Date(2026, 4, 15), // viernes 15 mayo 2026
      viewMode: 'week',
      visibleSessions: [],
    });
    expect(semantic.label).toContain('vista semanal');
    expect(semantic.label).toContain('11 de mayo');
    expect(semantic.label).toContain('17 de mayo');
  });

  it('day view label includes specific date', () => {
    const semantic = buildCalendarSemantic({
      currentDate: new Date(2026, 4, 15),
      viewMode: 'day',
      visibleSessions: [],
    });
    expect(semantic.label).toContain('vista día');
    expect(semantic.label).toContain('15 de mayo 2026');
  });

  it('includes sesiones visibles count', () => {
    const semantic = buildCalendarSemantic({
      currentDate: new Date(2026, 4, 15),
      viewMode: 'week',
      visibleSessions: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
    });
    expect(semantic.label).toContain('3 sesiones visibles');
  });

  it('exposes "este equipo" when filterTeam is active', () => {
    const semantic = buildCalendarSemantic({
      currentDate: new Date(),
      viewMode: 'month',
      visibleSessions: [],
      filterTeam: { id: 't1', teamName: 'Juniors B' },
    });
    expect(semantic.referableIds['este equipo']).toBe('t1');
    expect(semantic.label).toContain('Juniors B');
  });

  it('exposes "esta sesión" only when day view has exactly one session', () => {
    const oneSession = buildCalendarSemantic({
      currentDate: new Date(),
      viewMode: 'day',
      visibleSessions: [{ id: 's1' }],
      daySessionList: [{ id: 's1' }],
    });
    expect(oneSession.referableIds['esta sesión']).toBe('s1');

    const twoSessions = buildCalendarSemantic({
      currentDate: new Date(),
      viewMode: 'day',
      visibleSessions: [{ id: 's1' }, { id: 's2' }],
      daySessionList: [{ id: 's1' }, { id: 's2' }],
    });
    expect(twoSessions.referableIds?.['esta sesión']).toBeUndefined();

    const monthOneSession = buildCalendarSemantic({
      currentDate: new Date(),
      viewMode: 'month',
      visibleSessions: [{ id: 's1' }],
    });
    // Vista mes con 1 sesión total no debería exponer "esta sesión"
    // (el usuario probablemente está mirando el mes, no esa sesión).
    expect(monthOneSession.referableIds?.['esta sesión']).toBeUndefined();
  });

  it('omits referableIds entirely when nothing referenciable', () => {
    const semantic = buildCalendarSemantic({
      currentDate: new Date(),
      viewMode: 'month',
      visibleSessions: [],
    });
    expect(semantic.referableIds).toBeUndefined();
  });
});
