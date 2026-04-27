import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowRight } from 'lucide-react';
import { HELP_ARTICLES, HELP_CATEGORIES } from '../content/helpArticles';
import { useAuth } from '../contexts/AuthContext';
import HelpBreadcrumb from '../components/help/HelpBreadcrumb';
import HelpArticleCard from '../components/help/HelpArticleCard';
import { SITE_URL, OG_IMAGE } from '../siteConfig';

function formatDateEs(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HelpArticleScreen() {
  const { slug } = useParams();
  const { user } = useAuth();

  const article = useMemo(() => HELP_ARTICLES.find((a) => a.slug === slug), [slug]);
  const related = useMemo(() => {
    if (!article) return [];
    return HELP_ARTICLES.filter((a) => a.category === article.category && a.slug !== article.slug).slice(0, 4);
  }, [article]);

  if (!article) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Artículo no encontrado</h1>
          <p className="text-slate-600 mb-6">No encontramos el artículo «{slug}».</p>
          <Link to="/ayuda" className="text-blue-700 font-medium hover:underline">
            Volver al centro de ayuda
          </Link>
        </div>
      </div>
    );
  }

  const categoryLabel = HELP_CATEGORIES[article.category]?.label || article.category;
  const articleUrl = `${SITE_URL}/ayuda/${article.slug}`;
  const pageTitle = `${article.title} — Ayuda de Pick&Coach`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.summary,
    dateModified: article.updatedAt,
    url: articleUrl,
    image: OG_IMAGE,
    author: {
      '@type': 'Organization',
      name: 'Pick&Coach',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Pick&Coach',
    },
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={article.summary} />
        <link rel="canonical" href={articleUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.summary} />
        <meta property="og:url" content={articleUrl} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={article.summary} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-10 lg:py-14">
        <HelpBreadcrumb category={article.category} categoryLabel={categoryLabel} articleTitle={article.title} />

        <header className="mt-6 mb-10">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full mb-3">
            {categoryLabel}
          </span>
          <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-3">{article.title}</h1>
          <p className="text-sm text-slate-500">Última actualización: {formatDateEs(article.updatedAt)}</p>
        </header>

        <article className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-blue-700">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node: _node, ...props }) =>
                props.href && /^https?:\/\//.test(props.href) ? (
                  <a {...props} target="_blank" rel="noopener noreferrer">
                    {props.children}
                  </a>
                ) : (
                  <a {...props}>{props.children}</a>
                ),
            }}
          >
            {article.body}
          </ReactMarkdown>
        </article>

        {related.length > 0 && (
          <section className="mt-16 pt-8 border-t border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Otros artículos de {categoryLabel}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map((a) => (
                <HelpArticleCard key={a.id} article={a} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 p-6 lg:p-8 bg-white border border-blue-100 rounded-2xl shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">¿Aún tienes preguntas?</h2>
          <p className="text-slate-600 mb-4">
            Pregúntale a Pick desde tu cuenta — responde con tu contexto y puede ejecutar acciones por ti.
          </p>
          <Link
            to={user ? '/area-privada' : '/login'}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Pregúntale a Pick <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  );
}
