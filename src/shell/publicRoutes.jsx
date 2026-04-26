import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Public placeholders for F1.1 — real implementations land in F1.4 (landing) and F1.5 (help center).
// Defined here (not in AppRouter) so the prerender entry can mount the same components without
// pulling in the full client provider tree (Firebase, Auth, Pick, etc.).

function LandingPlaceholder() {
  return <div style={{ padding: 40 }}>Pick&amp;Coach landing (placeholder — implemented in F1.4)</div>;
}

function HelpIndexPlaceholder() {
  return <div style={{ padding: 40 }}>Centro de ayuda (placeholder — implemented in F1.5)</div>;
}

function HelpArticlePlaceholder() {
  return <div style={{ padding: 40 }}>Artículo de ayuda (placeholder — implemented in F1.5)</div>;
}

export const PUBLIC_ROUTE_DEFS = [
  { path: '/', element: <LandingPlaceholder /> },
  { path: '/ayuda', element: <HelpIndexPlaceholder /> },
  { path: '/ayuda/:slug', element: <HelpArticlePlaceholder /> },
];

// Used by the prerender entry (src/entry-prerender.jsx). Rendered in a StaticRouter context
// without any of the client-only providers — public pages must work without auth/firebase.
export default function PublicRoutesOnly() {
  return (
    <Routes>
      {PUBLIC_ROUTE_DEFS.map((r) => (
        <Route key={r.path} path={r.path} element={r.element} />
      ))}
    </Routes>
  );
}
