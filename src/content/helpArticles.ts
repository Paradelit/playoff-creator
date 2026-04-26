/**
 * Single source of truth for editorial content.
 *
 * Consumed by:
 * - The public web (/ayuda index and /ayuda/:slug detail pages).
 * - The AI agent's knowledge base indexer (functions/scripts/indexKnowledge.ts),
 *   which embeds each article and writes it to Firestore `knowledgeBase/{id}`
 *   for use by the `search_knowledge_base` tool.
 *
 * Principle: anything in this file is BOTH publicly publishable AND consumed
 * by the agent. There is no separate "agent-only" or "draft" content.
 */

export type HelpCategory = 'app-usage' | 'competition-rules' | 'bracket-engine' | 'basketball-concepts';

export interface HelpArticle {
  /** Stable internal id (e.g. "app-create-team"). Used as Firestore doc id. */
  id: string;
  /** URL-facing slug (SEO-friendly Spanish, e.g. "como-crear-equipo"). Mounted at /ayuda/:slug. */
  slug: string;
  category: HelpCategory;
  /** Used in lists and as <title>. */
  title: string;
  /** 1-2 sentences (120-160 chars). Used in <meta description>, index cards, agent preview. */
  summary: string;
  /** Markdown. Rendered on detail page; embedded for semantic search. */
  body: string;
  /** Optional — boost in client-side search scoring. */
  tags?: string[];
  /** Optional — order within category (lower = earlier). */
  order?: number;
  /** ISO date — shown as "Última actualización: 25 abr 2026". */
  updatedAt: string;
}

export const HELP_CATEGORIES: Record<
  HelpCategory,
  {
    label: string;
    description: string;
    order: number;
  }
> = {
  'app-usage': {
    label: 'Guías de uso',
    description: 'Cómo usar Pick&Coach paso a paso',
    order: 1,
  },
  'competition-rules': {
    label: 'Reglas y formatos',
    description: 'Formatos de competición y series',
    order: 2,
  },
  'bracket-engine': {
    label: 'Motor de cuadros',
    description: 'Cómo funcionan los cuadros de playoffs',
    order: 3,
  },
  'basketball-concepts': {
    label: 'Conceptos de baloncesto',
    description: 'Fundamentos, posiciones y sistemas',
    order: 4,
  },
};

export const HELP_ARTICLES: HelpArticle[] = [
  // Articles populated in Task 2.3 after migration + curation.
];
