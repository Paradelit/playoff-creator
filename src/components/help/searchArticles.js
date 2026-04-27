function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const TITLE_WEIGHT = 10;
const SUMMARY_WEIGHT = 4;
const TAG_WEIGHT = 6;

/**
 * Returns articles whose normalized title/summary/tags contain the query,
 * sorted by descending score. Pure function, no side effects.
 */
export function searchArticles(query, articles) {
  const q = normalize(query.trim());
  if (!q) return [];

  const scored = [];
  for (const a of articles) {
    let score = 0;
    if (normalize(a.title).includes(q)) score += TITLE_WEIGHT;
    if (normalize(a.summary).includes(q)) score += SUMMARY_WEIGHT;
    if (a.tags) {
      for (const t of a.tags) {
        if (normalize(t).includes(q)) {
          score += TAG_WEIGHT;
          break;
        }
      }
    }
    if (score > 0) scored.push({ article: a, score });
  }
  scored.sort((x, y) => y.score - x.score);
  return scored.map((s) => s.article);
}
