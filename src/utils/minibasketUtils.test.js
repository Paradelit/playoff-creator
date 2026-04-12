import { describe, it, expect } from 'vitest';
import { isMinibasketSextos, validateSextos } from './minibasketUtils';

describe('isMinibasketSextos', () => {
  it('returns true for Benjamín 2º', () => {
    expect(isMinibasketSextos({ categoria: 'Benjamín', año: '2º' })).toBe(true);
  });

  it('returns true for Alevín 1º', () => {
    expect(isMinibasketSextos({ categoria: 'Alevín', año: '1º' })).toBe(true);
  });

  it('returns true for Alevín 2º', () => {
    expect(isMinibasketSextos({ categoria: 'Alevín', año: '2º' })).toBe(true);
  });

  it('returns false for non-minibasket categories', () => {
    expect(isMinibasketSextos({ categoria: 'Infantil', año: '1º' })).toBe(false);
    expect(isMinibasketSextos({ categoria: 'Cadete', año: '1º' })).toBe(false);
    expect(isMinibasketSextos({ categoria: 'Senior' })).toBe(false);
  });

  it('returns false for Benjamín 1º', () => {
    expect(isMinibasketSextos({ categoria: 'Benjamín', año: '1º' })).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isMinibasketSextos(null)).toBe(false);
    expect(isMinibasketSextos(undefined)).toBe(false);
  });
});

describe('validateSextos', () => {
  it('marks valid when 2-3 of first 5 periods are true', () => {
    const jugadores = [
      { nombre: 'A', sextos: [true, true, false, false, false, true] },
      { nombre: 'B', sextos: [true, true, true, false, false, false] },
    ];
    const result = validateSextos(jugadores);
    expect(result[0].valid).toBe(true);
    expect(result[0].countFirst5).toBe(2);
    expect(result[1].valid).toBe(true);
    expect(result[1].countFirst5).toBe(3);
  });

  it('marks invalid when fewer than 2 of first 5', () => {
    const jugadores = [{ nombre: 'A', sextos: [true, false, false, false, false, true] }];
    const result = validateSextos(jugadores);
    expect(result[0].valid).toBe(false);
    expect(result[0].countFirst5).toBe(1);
  });

  it('marks invalid when more than 3 of first 5', () => {
    const jugadores = [{ nombre: 'A', sextos: [true, true, true, true, false, false] }];
    const result = validateSextos(jugadores);
    expect(result[0].valid).toBe(false);
    expect(result[0].countFirst5).toBe(4);
  });
});
