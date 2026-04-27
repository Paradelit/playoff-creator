import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { HELP_ARTICLES } from '../../content/helpArticles';
import { usePublicTheme } from '../../hooks/usePublicTheme';
import HelpArticleCard from '../help/HelpArticleCard';

const FEATURED_SLUGS = [
  'como-crear-un-equipo',
  'generar-entrenamiento-con-ia',
  'importar-calendario-excel',
  'como-crear-cuadro-de-playoffs',
  'biblioteca-de-ejercicios',
  'cuaderno-del-entrenador',
];

export default function FeaturedHelp() {
  const { theme } = usePublicTheme();
  const darkTheme = theme === 'dark';
  const featured = FEATURED_SLUGS.map((slug) => HELP_ARTICLES.find((article) => article.slug === slug))
    .filter(Boolean)
    .slice(0, 6);

  if (featured.length === 0) return null;

  return (
    <section className="bg-white py-20 transition-colors dark:bg-[#0a0a18] lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12 flex items-end justify-between gap-4">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-orange-400">Centro de ayuda</p>
            <h2 className="mb-3 text-3xl font-extrabold text-slate-900 dark:text-white lg:text-4xl">
              Aprende a usarlo
            </h2>
            <p className="text-slate-600 dark:text-slate-400">Guías destacadas para sacarle el máximo partido.</p>
          </div>
          <Link
            to="/ayuda"
            className="hidden items-center gap-1 font-medium text-orange-400 transition-colors hover:text-orange-300 sm:inline-flex"
          >
            Ver todos <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((article) => (
            <HelpArticleCard key={article.id} article={article} dark={darkTheme} />
          ))}
        </div>
      </div>
    </section>
  );
}
