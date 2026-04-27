// src/components/landing/FeaturedHelp.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { HELP_ARTICLES } from '../../content/helpArticles';
import HelpArticleCard from '../help/HelpArticleCard';

// Slugs of articles to feature on the landing.
// Edit this list to curate the front page (no schema change needed).
const FEATURED_SLUGS = [
  'como-crear-un-equipo',
  'generar-entrenamiento-con-ia',
  'importar-calendario-excel',
  'como-crear-cuadro-de-playoffs',
  'biblioteca-de-ejercicios',
  'cuaderno-del-entrenador',
];

export default function FeaturedHelp() {
  const featured = FEATURED_SLUGS.map((slug) => HELP_ARTICLES.find((a) => a.slug === slug))
    .filter(Boolean)
    .slice(0, 6);

  if (featured.length === 0) return null;

  return (
    <section
      className="py-20 lg:py-28"
      style={{ background: 'linear-gradient(180deg, #0a0a18 0%, #0a0a18 100%)' }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-xs font-bold tracking-widest text-orange-400 uppercase mb-3">Centro de ayuda</p>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-3">Aprende a usarlo</h2>
            <p className="text-slate-400">Guías destacadas para sacarle el máximo partido.</p>
          </div>
          <Link
            to="/ayuda"
            className="hidden sm:inline-flex items-center gap-1 text-orange-400 font-medium hover:text-orange-300 transition-colors"
          >
            Ver todos <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {featured.map((a) => (
            <HelpArticleCard key={a.id} article={a} dark />
          ))}
        </div>
      </div>
    </section>
  );
}
