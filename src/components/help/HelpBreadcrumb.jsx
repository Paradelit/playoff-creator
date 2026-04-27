import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function HelpBreadcrumb({ category, categoryLabel, articleTitle }) {
  // category param reserved for a future /ayuda/categoria/:cat route — currently
  // category is rendered as text only (not a link).
  void category;
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
      <ol className="flex items-center gap-1 flex-wrap">
        <li>
          <Link to="/ayuda" className="hover:text-blue-700">
            Centro de ayuda
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight size={14} />
        </li>
        <li>
          {/* When /ayuda/categoria/:cat ships, wrap in <Link to={`/ayuda/categoria/${category}`}>. */}
          <span>{categoryLabel}</span>
        </li>
        <li aria-hidden="true">
          <ChevronRight size={14} />
        </li>
        <li className="text-slate-900 font-medium" aria-current="page">
          {articleTitle}
        </li>
      </ol>
    </nav>
  );
}
