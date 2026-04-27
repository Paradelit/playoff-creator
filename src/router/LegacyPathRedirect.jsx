import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Redirect any legacy path (e.g. /teams/:teamId, /playoffs, /calendar/...) to its
 * /area-privada equivalent, preserving the rest of the path, query, and hash.
 *
 * Used in AppRouter for backward compatibility with old bookmarks.
 */
export default function LegacyPathRedirect() {
  const location = useLocation();
  const target = `/area-privada${location.pathname}${location.search}${location.hash}`;
  return <Navigate to={target} replace />;
}
