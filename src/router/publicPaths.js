/**
 * Returns true if the given pathname is a public route (no auth required).
 * Used by AppShell and other layout decisions to know when to skip sidebars/nav.
 */
export function isPublicPath(pathname) {
  if (pathname === '/') return true;
  if (pathname === '/v2') return true;
  if (pathname === '/login') return true;
  if (pathname === '/ayuda') return true;
  if (pathname.startsWith('/ayuda/')) return true;
  if (pathname === '/precios') return true;
  if (pathname === '/para-clubes') return true;
  if (pathname.startsWith('/s/')) return true;
  if (pathname.startsWith('/exercise/')) return true;
  return false;
}
