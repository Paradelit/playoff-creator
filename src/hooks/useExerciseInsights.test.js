import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useExerciseInsights } from './useExerciseInsights';

function fixedDate(y, m, d) {
  return new Date(y, m - 1, d);
}

function trainingWithRefs(fecha, libIds) {
  return {
    id: `tr-${fecha}-${libIds.join('-')}`,
    meta: { fecha },
    ejercicios: libIds.map((id) => ({ libExerciseId: id })),
  };
}

describe('useExerciseInsights', () => {
  const today = fixedDate(2026, 4, 18);

  it('returns empty buckets when there is no data', () => {
    const { result } = renderHook(() => useExerciseInsights([], [], today));
    expect(result.current.favorites).toEqual([]);
    expect(result.current.recentlyUsed).toEqual([]);
    expect(result.current.trending).toEqual([]);
    expect(Object.keys(result.current.usageById)).toHaveLength(0);
  });

  it('surfaces favorites sorted by name', () => {
    const exercises = [
      { id: 'a', nombre: 'Balón al poste', favorite: true },
      { id: 'b', nombre: 'Aro pasivo', favorite: true },
      { id: 'c', nombre: 'No favorito' },
    ];
    const { result } = renderHook(() => useExerciseInsights(exercises, [], today));
    expect(result.current.favorites.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('builds Recién usados sorted by last use, deduped', () => {
    const exercises = [
      { id: 'e1', nombre: 'E1' },
      { id: 'e2', nombre: 'E2' },
    ];
    const trainings = [
      trainingWithRefs('2026-04-10', ['e1']),
      trainingWithRefs('2026-04-17', ['e1']),
      trainingWithRefs('2026-04-16', ['e2']),
    ];
    const { result } = renderHook(() => useExerciseInsights(exercises, trainings, today));
    expect(result.current.recentlyUsed.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('credits variant usage to the root exercise', () => {
    const exercises = [
      { id: 'root', nombre: 'Root' },
      { id: 'var', nombre: 'Variante', parentId: 'root' },
    ];
    const trainings = [trainingWithRefs('2026-04-17', ['var']), trainingWithRefs('2026-04-16', ['var'])];
    const { result } = renderHook(() => useExerciseInsights(exercises, trainings, today));
    expect(result.current.recentlyUsed.map((e) => e.id)).toEqual(['root']);
    expect(result.current.trending.map((e) => e.id)).toEqual(['root']);
    expect(result.current.usageById.root.count30d).toBe(2);
  });

  it('only flags Tendencias when used at least twice in the last 30 days', () => {
    const exercises = [
      { id: 'a', nombre: 'Usado mucho' },
      { id: 'b', nombre: 'Usado una vez' },
    ];
    const trainings = [
      trainingWithRefs('2026-04-17', ['a']),
      trainingWithRefs('2026-04-10', ['a']),
      trainingWithRefs('2026-04-17', ['b']),
    ];
    const { result } = renderHook(() => useExerciseInsights(exercises, trainings, today));
    const trendingIds = result.current.trending.map((e) => e.id);
    expect(trendingIds).toContain('a');
    expect(trendingIds).not.toContain('b');
  });

  it('ignores usage older than 30 days for Tendencias but keeps it for Recién usados', () => {
    const exercises = [{ id: 'a', nombre: 'A' }];
    const trainings = [trainingWithRefs('2026-02-01', ['a']), trainingWithRefs('2026-02-10', ['a'])];
    const { result } = renderHook(() => useExerciseInsights(exercises, trainings, today));
    expect(result.current.trending).toEqual([]);
    expect(result.current.recentlyUsed.map((e) => e.id)).toEqual(['a']);
    expect(result.current.usageById.a.count30d).toBe(0);
    expect(result.current.usageById.a.countAll).toBe(2);
  });

  it('respects the limit for both sections', () => {
    const exercises = Array.from({ length: 10 }, (_, i) => ({ id: `e${i}`, nombre: `E${i}` }));
    const trainings = exercises.flatMap((ex) => [
      trainingWithRefs('2026-04-17', [ex.id]),
      trainingWithRefs('2026-04-16', [ex.id]),
    ]);
    const { result } = renderHook(() => useExerciseInsights(exercises, trainings, today, { limit: 4 }));
    expect(result.current.recentlyUsed).toHaveLength(4);
    expect(result.current.trending).toHaveLength(4);
  });
});
