export const EXERCISE_CATEGORIES = [
  { id: 'tiro', label: 'Tiro', emoji: '🎯', aliases: ['tiro', 'shooting', 'shot', 'tiros'] },
  { id: 'defensa', label: 'Defensa', emoji: '🛡️', aliases: ['defensa', 'defense', 'defensive', 'defensivo'] },
  { id: 'ataque', label: 'Ataque', emoji: '⚔️', aliases: ['ataque', 'attack', 'offensive', 'ofensivo'] },
  { id: 'pase', label: 'Pase', emoji: '🤝', aliases: ['pase', 'passing', 'pases'] },
  { id: 'bote', label: 'Bote', emoji: '🏀', aliases: ['bote', 'dribble', 'dribbling', 'manejo'] },
  { id: 'rebote', label: 'Rebote', emoji: '📦', aliases: ['rebote', 'rebound', 'rebotes'] },
  { id: 'tactica', label: 'Táctica', emoji: '♟️', aliases: ['tactica', 'táctica', 'tactic', 'sistema'] },
  {
    id: 'calentamiento',
    label: 'Calentamiento',
    emoji: '🔥',
    aliases: ['calentamiento', 'warmup', 'warm-up', 'calentar'],
  },
  { id: 'fisico', label: 'Físico', emoji: '💪', aliases: ['fisico', 'físico', 'condicional', 'physical'] },
  {
    id: 'reducido',
    label: 'Juego reducido',
    emoji: '🎲',
    aliases: ['reducido', '3vs3', '2vs2', 'small', 'juego reducido'],
  },
];

export const EXERCISE_PHASES = [
  { id: 'calentamiento', label: 'Calentamiento' },
  { id: 'principal', label: 'Principal' },
  { id: 'cierre', label: 'Cierre' },
];

export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5];

function normalize(tag) {
  if (typeof tag !== 'string') return '';
  return tag.trim().toLowerCase();
}

const ALIAS_TO_CATEGORY = (() => {
  const map = new Map();
  for (const cat of EXERCISE_CATEGORIES) {
    for (const alias of cat.aliases) map.set(normalize(alias), cat.id);
  }
  return map;
})();

export function matchCategory(tag) {
  const key = normalize(tag);
  if (!key) return null;
  return ALIAS_TO_CATEGORY.get(key) || null;
}

export function categoryById(id) {
  return EXERCISE_CATEGORIES.find((c) => c.id === id) || null;
}

export function activeCategoryIds(tags) {
  const ids = new Set();
  for (const t of tags || []) {
    const id = matchCategory(t);
    if (id) ids.add(id);
  }
  return ids;
}

export function toggleCategoryInTags(tags, categoryId) {
  const cat = categoryById(categoryId);
  if (!cat) return tags || [];
  const current = Array.isArray(tags) ? tags : [];
  const hasCategory = current.some((t) => matchCategory(t) === categoryId);
  if (hasCategory) {
    return current.filter((t) => matchCategory(t) !== categoryId);
  }
  return [...current, cat.label];
}
