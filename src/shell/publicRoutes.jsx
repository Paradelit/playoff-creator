import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Public routes for F1.4 (landing) and F1.5 (help center).
// Defined here (not in AppRouter) so the prerender entry can mount the same components without
// pulling in the full client provider tree (Firebase, Auth, Pick, etc.).
//
// NOTE: LandingScreen is imported directly (not lazy) so the SSR prerender entry
// (entry-prerender.jsx) can render it synchronously via renderToString.

import LandingScreen from '../screens/LandingScreen';
import HelpIndexScreen from '../screens/HelpIndexScreen';
import HelpArticleScreen from '../screens/HelpArticleScreen';
// sub-proyecto 7 — marketing público de precios y B2B.
import PricingScreen from '../screens/PricingScreen';
import ParaClubesScreen from '../screens/ParaClubesScreen';
import PublicNavbar from '../components/public/PublicNavbar';
import { PublicThemeProvider } from '../contexts/PublicThemeContext';

function PublicLayout({ children }) {
  return (
    <PublicThemeProvider>
      <div className="min-h-screen bg-white text-slate-900 transition-colors dark:bg-[#05050d] dark:text-white">
        <PublicNavbar />
        {children}
      </div>
    </PublicThemeProvider>
  );
}

export const PUBLIC_ROUTE_DEFS = [
  {
    path: '/',
    element: (
      <PublicLayout>
        <LandingScreen />
      </PublicLayout>
    ),
  },
  {
    path: '/ayuda',
    element: (
      <PublicLayout>
        <HelpIndexScreen />
      </PublicLayout>
    ),
  },
  {
    path: '/ayuda/:slug',
    element: (
      <PublicLayout>
        <HelpArticleScreen />
      </PublicLayout>
    ),
  },
  // sub-proyecto 7 — funnel B2C/B2B.
  {
    path: '/precios',
    element: (
      <PublicLayout>
        <PricingScreen />
      </PublicLayout>
    ),
  },
  {
    path: '/para-clubes',
    element: (
      <PublicLayout>
        <ParaClubesScreen />
      </PublicLayout>
    ),
  },
  {
    // Legacy preview path. Redirect to root so any bookmarked /v2 keeps working.
    path: '/v2',
    element: <Navigate to="/" replace />,
  },
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
