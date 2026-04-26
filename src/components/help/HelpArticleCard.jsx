// src/components/help/HelpArticleCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function HelpArticleCard({ article }) {
  return (
    <Link
      to={`/ayuda/${article.slug}`}
      className="group block p-5 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all"
    >
      <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 mb-1.5">{article.title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{article.summary}</p>
      <span className="inline-flex items-center gap-1 mt-3 text-sm text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Leer más <ArrowRight size={14} aria-hidden="true" />
      </span>
    </Link>
  );
}
