import React, { useCallback, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { HELP_ARTICLES, HELP_CATEGORIES } from '../content/helpArticles';
import HelpSearch from '../components/help/HelpSearch';
import HelpArticleCard from '../components/help/HelpArticleCard';
import { searchArticles } from '../components/help/searchArticles';
import { SITE_URL, OG_IMAGE } from '../siteConfig';

const TITLE = 'Centro de ayuda — Pick&Coach';
const DESCRIPTION = 'Guías, reglas, y conceptos. Aprende a sacar el máximo partido a Pick&Coach.';

function articlesByCategory(articles) {
  const byCat = {};
  for (const a of articles) {
    if (!byCat[a.category]) byCat[a.category] = [];
    byCat[a.category].push(a);
  }
  for (const cat of Object.keys(byCat)) {
    byCat[cat].sort((x, y) => {
      if (x.order != null && y.order != null) return x.order - y.order;
      if (x.order != null) return -1;
      if (y.order != null) return 1;
      return x.title.localeCompare(y.title, 'es');
    });
  }
  return byCat;
}

function sortedCategories() {
  return Object.entries(HELP_CATEGORIES).sort((a, b) => a[1].order - b[1].order);
}

export default function HelpIndexScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState(() =>
    initialQuery.trim().length >= 2 ? searchArticles(initialQuery, HELP_ARTICLES) : null,
  );

  const onChange = useCallback(
    (next) => {
      setQuery(next);
      const params = new URLSearchParams(searchParams);
      if (next.trim()) params.set('q', next);
      else params.delete('q');
      setSearchParams(params, { replace: true });
      if (next.trim().length < 2) setResults(null);
    },
    [searchParams, setSearchParams],
  );

  const onSearch = useCallback(async (q) => {
    setResults(searchArticles(q, HELP_ARTICLES));
  }, []);

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
          <p className="text-lg text-slate-600 mb-8">Guías para sacar el máximo a Pick&amp;Coach.</p>
          <HelpSearch query={query} onChange={onChange} onSearch={onSearch} autoFocus />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
        {showResults ? (
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">
              {results.length} resultado{results.length === 1 ? '' : 's'} para «{query}»
            </h2>
            {results.length === 0 ? (
              <p className="text-slate-600">
                No encontramos artículos para «{query}». Prueba otra búsqueda o{' '}
                <button onClick={() => onChange('')} className="text-blue-700 hover:underline">
                  vuelve al índice
                </button>
                .
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {results.map((a) => (
                  <HelpArticleCard key={a.id} article={a} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-12">
            {sortedCategories().map(([catKey, catMeta]) => {
              const articles = grouped[catKey] || [];
              if (articles.length === 0) return null;
              return (
                <section key={catKey}>
                  <h2 className="text-2xl font-semibold text-slate-900 mb-1">{catMeta.label}</h2>
                  <p className="text-slate-600 mb-5">{catMeta.description}</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {articles.map((a) => (
                      <HelpArticleCard key={a.id} article={a} />
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
