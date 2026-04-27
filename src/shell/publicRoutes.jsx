import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Public routes for F1.4 (landing) and F1.5 (help center).
// Defined here (not in AppRouter) so the prerender entry can mount the same components without
// pulling in the full client provider tree (Firebase, Auth, Pick, etc.).
//
// NOTE: LandingScreen is imported directly (not lazy) so the SSR prerender entry
// (entry-prerender.jsx) can render it synchronously via renderToString.

import LandingScreen from '../screens/LandingScreen';
import HelpIndexScreen from '../screens/HelpIndexScreen';
import HelpArticleScreen from '../screens/HelpArticleScreen';

export const PUBLIC_ROUTE_DEFS = [
  { path: '/', element: <LandingScreen /> },
  { path: '/ayuda', element: <HelpIndexScreen /> },
  { path: '/ayuda/:slug', element: <HelpArticleScreen /> },
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
