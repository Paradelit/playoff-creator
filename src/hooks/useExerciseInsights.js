import { useMemo } from 'react';

const TRENDING_WINDOW_DAYS = 30;
const DEFAULT_LIMIT = 6;

function toMillis(raw) {
  if (!raw) return 0;
  if (typeof raw === 'object' && typeof raw.toMillis === 'function') return raw.toMillis();
  if (typeof raw === 'number') return raw;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'string') {
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

function trainingTimestamp(training) {
  if (training?.meta?.fecha) {
    const [y, m, d] = String(training.meta.fecha).split('-').map(Number);
    if (y && m && d) return new Date(y, m - 1, d).getTime();
  }
  return toMillis(training?.updatedAt || training?.createdAt);
}

function walkUsage(allTrainings, rootIdOf, nowMs) {
  const cutoff = nowMs - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const usage = new Map();
  for (const training of allTrainings || []) {
    const ts = trainingTimestamp(training);
    if (!ts) continue;
    const within30 = ts >= cutoff;
    const seenInTraining = new Set();
    for (const ej of training.ejercicios || []) {
      if (!ej?.libExerciseId) continue;
      const rootId = rootIdOf(ej.libExerciseId);
      if (!rootId) continue;
      const entry = usage.get(rootId) || { count30d: 0, countAll: 0, lastUsedMs: 0 };
      entry.countAll += 1;
      if (within30 && !seenInTraining.has(rootId)) {
        entry.count30d += 1;
        seenInTraining.add(rootId);
      }
      if (ts > entry.lastUsedMs) entry.lastUsedMs = ts;
      usage.set(rootId, entry);
    }
  }
  return usage;
}

/**
 * Derives Favoritos / Recién usados / Tendencias + per-exercise usage stats.
 *
 * Variants are credited to their root (`parentId ?? id`) so discovery sections
 * show one card per drill family.
 */
export function useExerciseInsights(exercises, allTrainings, now = new Date(), { limit = DEFAULT_LIMIT } = {}) {
  return useMemo(() => {
    const exerciseList = Array.isArray(exercises) ? exercises : [];
    const byId = new Map(exerciseList.map((ex) => [ex.id, ex]));
    const rootIdOf = (id) => {
      const ex = byId.get(id);
      if (!ex) return null;
      return ex.parentId ?? ex.id;
    };

    const nowMs = (now instanceof Date ? now : new Date(now)).getTime();
    const usage = walkUsage(allTrainings, rootIdOf, nowMs);

    const usageById = Object.fromEntries(usage.entries());

    const favorites = exerciseList
      .filter((ex) => ex.favorite === true)
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    const recentlyUsed = [...usage.entries()]
      .sort((a, b) => b[1].lastUsedMs - a[1].lastUsedMs)
      .map(([id]) => byId.get(id))
      .filter(Boolean)
      .slice(0, limit);

    const trending = [...usage.entries()]
      .filter(([, u]) => u.count30d >= 2)
      .sort((a, b) => b[1].count30d - a[1].count30d || b[1].lastUsedMs - a[1].lastUsedMs)
      .map(([id]) => byId.get(id))
      .filter(Boolean)
      .slice(0, limit);

    return { favorites, recentlyUsed, trending, usageById };
  }, [exercises, allTrainings, now, limit]);
}
