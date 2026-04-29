import { describe, it, expect } from 'vitest';
import { estimarDuracionPartido, DURACION_PARTIDO_FALLBACK } from './constants';

describe('estimarDuracionPartido', () => {
  it('returns 75 for Minibasket', () => {
    expect(estimarDuracionPartido({ categoria: 'Minibasket' })).toBe(75);
  });
  it('is case-insensitive', () => {
    expect(estimarDuracionPartido({ categoria: 'minibasket' })).toBe(75);
    expect(estimarDuracionPartido({ categoria: 'MINIBASKET' })).toBe(75);
  });
  it('strips accents (Júnior → junior)', () => {
    expect(estimarDuracionPartido({ categoria: 'Júnior' })).toBe(100);
  });
  it('returns 90 for Cadete', () => {
    expect(estimarDuracionPartido({ categoria: 'Cadete' })).toBe(90);
  });
  it('returns fallback 90 for unknown category', () => {
    expect(estimarDuracionPartido({ categoria: 'Veteranos' })).toBe(DURACION_PARTIDO_FALLBACK);
  });
  it('returns fallback for null team', () => {
    expect(estimarDuracionPartido(null)).toBe(DURACION_PARTIDO_FALLBACK);
  });
  it('returns fallback for empty categoria', () => {
    expect(estimarDuracionPartido({})).toBe(DURACION_PARTIDO_FALLBACK);
  });
});
