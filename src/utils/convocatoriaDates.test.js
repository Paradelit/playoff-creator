import { describe, it, expect } from 'vitest';
import { saludoFromHour, fechaRelativa } from './convocatoriaDates';

describe('saludoFromHour', () => {
  it('Buenos días before 14:00', () => {
    expect(saludoFromHour(8)).toBe('Buenos días');
    expect(saludoFromHour(13)).toBe('Buenos días');
  });
  it('Buenas tardes 14:00-17:59', () => {
    expect(saludoFromHour(14)).toBe('Buenas tardes');
    expect(saludoFromHour(17)).toBe('Buenas tardes');
  });
  it('Buenas noches from 18:00', () => {
    expect(saludoFromHour(18)).toBe('Buenas noches');
    expect(saludoFromHour(23)).toBe('Buenas noches');
  });
});

describe('fechaRelativa', () => {
  const now = new Date('2026-04-29T10:00:00');
  it('returns "hoy" for same day', () => {
    expect(fechaRelativa('2026-04-29', now)).toBe('hoy');
  });
  it('returns "mañana" for next day', () => {
    expect(fechaRelativa('2026-04-30', now)).toBe('mañana');
  });
  it('returns weekday for 2-6 days', () => {
    expect(fechaRelativa('2026-05-02', now)).toBe('el sábado');
  });
  it('returns full date for 7+ days', () => {
    expect(fechaRelativa('2026-05-15', now)).toBe('el 15 de mayo');
  });
});
