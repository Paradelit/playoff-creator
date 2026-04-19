import { useMemo, useState } from 'react';
import { activeCategoryIds } from '../utils/exerciseCategories';

const EMPTY_FILTERS = {
  search: '',
  categories: [],
  phase: null,
  difficulty: null,
  favoritesOnly: false,
};

function matchesSearch(ex, needle) {
  if (!needle) return true;
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return (
    (ex.nombre || '').toLowerCase().includes(q) ||
    (ex.descripcion || '').toLowerCase().includes(q) ||
    (ex.objetivo || '').toLowerCase().includes(q) ||
    (ex.tags || []).some((t) => t.toLowerCase().includes(q))
  );
}

function matchesCategories(ex, categoryIds) {
  if (!categoryIds || categoryIds.length === 0) return true;
  const exCategories = new Set(activeCategoryIds(ex.tags || []));
  return categoryIds.every((id) => exCategories.has(id));
}

/**
 * Filter/search state for the Biblioteca screen. Returns the filtered list
 * plus a grouped view that keeps parent/variant relationships intact.
 *
 * Grouping rules: if a variant passes the filter but its parent does not,
 * the variant is promoted to a root so it still renders.
 */
export function useExerciseFilters(exercises) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const toggleCategory = (id) =>
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(id) ? prev.categories.filter((c) => c !== id) : [...prev.categories, id],
    }));

  const reset = () => setFilters(EMPTY_FILTERS);

  const hasActiveFilters = useMemo(
    () =>
      !!filters.search ||
      filters.categories.length > 0 ||
      filters.phase != null ||
      filters.difficulty != null ||
      filters.favoritesOnly,
    [filters],
  );

  const filtered = useMemo(() => {
    const list = Array.isArray(exercises) ? exercises : [];
    return list.filter((ex) => {
      if (filters.favoritesOnly && !ex.favorite) return false;
      if (filters.phase && ex.fase !== filters.phase) return false;
      if (filters.difficulty != null && Number(ex.dificultad) !== Number(filters.difficulty)) return false;
      if (!matchesCategories(ex, filters.categories)) return false;
      if (!matchesSearch(ex, filters.search)) return false;
      return true;
    });
  }, [exercises, filters]);

  const { roots, variantMap } = useMemo(() => {
    const rootList = [];
    const map = new Map();
    for (const ex of filtered) {
      if (ex.parentId) {
        if (!map.has(ex.parentId)) map.set(ex.parentId, []);
        map.get(ex.parentId).push(ex);
      } else {
        rootList.push(ex);
      }
    }
    // Promote orphan variants (parent filtered out) to roots.
    for (const [parentId, variants] of map.entries()) {
      if (!rootList.some((r) => r.id === parentId)) {
        variants.forEach((v) => rootList.push(v));
        map.delete(parentId);
      }
    }
    return { roots: rootList, variantMap: map };
  }, [filtered]);

  return {
    filters,
    setFilter,
    toggleCategory,
    reset,
    hasActiveFilters,
    filtered,
    roots,
    variantMap,
  };
}
