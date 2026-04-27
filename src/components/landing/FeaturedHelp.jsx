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
    <section className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-3">Aprende a usarlo</h2>
            <p className="text-lg text-slate-600">Guías destacadas del centro de ayuda.</p>
          </div>
          <Link
            to="/ayuda"
            className="hidden sm:inline-flex items-center gap-1 text-blue-700 font-medium hover:text-blue-900"
          >
            Ver todos los artículos <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {featured.map((a) => (
            <HelpArticleCard key={a.id} article={a} />
          ))}
        </div>
      </div>
    </section>
  );
}
