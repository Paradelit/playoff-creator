import React, { useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { HELP_ARTICLES, HELP_CATEGORIES } from '../content/helpArticles';
import HelpSearch from '../components/help/HelpSearch';
import HelpArticleCard from '../components/help/HelpArticleCard';
import { searchArticles } from '../components/help/searchArticles';
import { SITE_URL, OG_IMAGE } from '../siteConfig';

const TITLE = 'Centro de ayuda - Pick&Coach';
const DESCRIPTION = 'Guias, reglas y conceptos. Aprende a sacar el maximo partido a Pick&Coach.';

function articlesByCategory(articles) {
  const byCat = {};
  for (const article of articles) {
    if (!byCat[article.category]) byCat[article.category] = [];
    byCat[article.category].push(article);
  }
  for (const category of Object.keys(byCat)) {
    byCat[category].sort((left, right) => {
      if (left.order != null && right.order != null) return left.order - right.order;
      if (left.order != null) return -1;
      if (right.order != null) return 1;
      return left.title.localeCompare(right.title, 'es');
    });
  }
  return byCat;
}

function sortedCategories() {
  return Object.entries(HELP_CATEGORIES).sort((left, right) => left[1].order - right[1].order);
}

export default function HelpIndexScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const results = useMemo(() => (query.trim().length >= 2 ? searchArticles(query, HELP_ARTICLES) : null), [query]);

  const onChange = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams);
      if (next.trim()) params.set('q', next);
      else params.delete('q');
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const onSearch = useCallback(async () => {}, []);
  const grouped = useMemo(() => articlesByCategory(HELP_ARTICLES), []);
  const showResults = results !== null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={SITE_URL + '/ayuda'} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={SITE_URL + '/ayuda'} />
        <meta property="og:image" content={OG_IMAGE} />
      </Helmet>

      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-3">Centro de ayuda</h1>
          <p className="text-lg text-slate-600 mb-8">Guias para sacar el maximo a Pick&amp;Coach.</p>
          <HelpSearch query={query} onChange={onChange} onSearch={onSearch} autoFocus />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
        {showResults ? (
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              {results.length} resultado{results.length === 1 ? '' : 's'} para "{query}"
            </h2>
            {results.length === 0 ? (
              <p className="text-slate-600">
                No encontramos articulos para "{query}". Prueba otra busqueda o{' '}
                <button onClick={() => onChange('')} className="text-blue-700 hover:underline">
                  vuelve al indice
                </button>
                .
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {results.map((article) => (
                  <HelpArticleCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-12">
            {sortedCategories().map(([categoryKey, categoryMeta]) => {
              const articles = grouped[categoryKey] || [];
              if (articles.length === 0) return null;
              return (
                <section key={categoryKey}>
                  <h2 className="text-2xl font-semibold text-slate-900 mb-1">{categoryMeta.label}</h2>
                  <p className="text-slate-600 mb-5">{categoryMeta.description}</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {articles.map((article) => (
                      <HelpArticleCard key={article.id} article={article} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
