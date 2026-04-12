import { describe, it, expect } from 'vitest';
import { teamDisplayName } from './teamUtils';

describe('teamDisplayName', () => {
  it('formats non-Senior with año and letra', () => {
    expect(teamDisplayName({ categoria: 'Infantil', año: '1º', letra: 'A', genero: 'Masculino' })).toBe(
      'Infantil 1º A · Masculino',
    );
  });

  it('formats Senior with division', () => {
    expect(teamDisplayName({ categoria: 'Senior', division: '1ª', genero: 'Femenino' })).toBe('Senior 1ª · Femenino');
  });

  it('omits genero when not present', () => {
    expect(teamDisplayName({ categoria: 'Cadete', año: '2º', letra: 'B' })).toBe('Cadete 2º B');
  });

  it('handles minimal team (categoria only)', () => {
    expect(teamDisplayName({ categoria: 'Prebenjamín' })).toBe('Prebenjamín');
  });

  it('Senior without division only shows categoria', () => {
    expect(teamDisplayName({ categoria: 'Senior', genero: 'Masculino' })).toBe('Senior · Masculino');
  });
});
