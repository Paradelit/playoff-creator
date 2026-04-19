import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExerciseFilters } from './useExerciseFilters';

const EXERCISES = [
  { id: 'e1', nombre: 'Tiro libre', tags: ['Tiro'], favorite: true, fase: 'principal', dificultad: 2 },
  { id: 'e2', nombre: 'Defensa 1x1', tags: ['Defensa'], favorite: false, fase: 'principal', dificultad: 3 },
  { id: 'e3', nombre: 'Pase y corte', tags: ['Pase', 'Ataque'], favorite: false, fase: 'calentamiento' },
  { id: 'e4', nombre: 'Variante tiro', tags: ['Tiro'], parentId: 'e1', favorite: false },
];

describe('useExerciseFilters', () => {
  it('returns everything when no filters are set', () => {
    const { result } = renderHook(() => useExerciseFilters(EXERCISES));
    expect(result.current.filtered).toHaveLength(4);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('free-text search matches name, description, objetivo and tags', () => {
    const list = [
      { id: 'a', nombre: 'Ejercicio A', descripcion: 'Secreto' },
      { id: 'b', nombre: 'B', objetivo: 'Lectura pick&roll' },
      { id: 'c', nombre: 'C', tags: ['tiro-exterior'] },
      { id: 'd', nombre: 'D' },
    ];
    const { result } = renderHook(() => useExerciseFilters(list));
    act(() => result.current.setFilter('search', 'secreto'));
    expect(result.current.filtered.map((e) => e.id)).toEqual(['a']);
    act(() => result.current.setFilter('search', 'pick&roll'));
    expect(result.current.filtered.map((e) => e.id)).toEqual(['b']);
    act(() => result.current.setFilter('search', 'exterior'));
    expect(result.current.filtered.map((e) => e.id)).toEqual(['c']);
  });

  it('AND-joins multiple curated categories', () => {
    const { result } = renderHook(() => useExerciseFilters(EXERCISES));
    act(() => result.current.toggleCategory('tiro'));
    expect(result.current.filtered.map((e) => e.id).sort()).toEqual(['e1', 'e4']);
    act(() => result.current.toggleCategory('pase'));
    expect(result.current.filtered).toHaveLength(0);
  });

  it('combines category filter with free-text search', () => {
    const { result } = renderHook(() => useExerciseFilters(EXERCISES));
    act(() => result.current.toggleCategory('tiro'));
    act(() => result.current.setFilter('search', 'variante'));
    expect(result.current.filtered.map((e) => e.id)).toEqual(['e4']);
  });

  it('filters by phase, difficulty and favoritesOnly', () => {
    const { result } = renderHook(() => useExerciseFilters(EXERCISES));
    act(() => result.current.setFilter('favoritesOnly', true));
    expect(result.current.filtered.map((e) => e.id)).toEqual(['e1']);
    act(() => result.current.setFilter('favoritesOnly', false));
    act(() => result.current.setFilter('phase', 'calentamiento'));
    expect(result.current.filtered.map((e) => e.id)).toEqual(['e3']);
    act(() => result.current.setFilter('phase', null));
    act(() => result.current.setFilter('difficulty', 3));
    expect(result.current.filtered.map((e) => e.id)).toEqual(['e2']);
  });

  it('groups variants under their parent', () => {
    const { result } = renderHook(() => useExerciseFilters(EXERCISES));
    expect(result.current.roots.map((e) => e.id).sort()).toEqual(['e1', 'e2', 'e3']);
    expect(result.current.variantMap.get('e1').map((v) => v.id)).toEqual(['e4']);
  });

  it('promotes orphan variants to roots when the parent is filtered out', () => {
    const { result } = renderHook(() => useExerciseFilters(EXERCISES));
    act(() => result.current.setFilter('search', 'variante'));
    expect(result.current.roots.map((e) => e.id)).toEqual(['e4']);
    expect(result.current.variantMap.size).toBe(0);
  });

  it('reset clears every filter', () => {
    const { result } = renderHook(() => useExerciseFilters(EXERCISES));
    act(() => result.current.toggleCategory('tiro'));
    act(() => result.current.setFilter('search', 'libre'));
    act(() => result.current.setFilter('favoritesOnly', true));
    expect(result.current.hasActiveFilters).toBe(true);
    act(() => result.current.reset());
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filtered).toHaveLength(4);
  });
});
