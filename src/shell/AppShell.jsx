import React from 'react';
import { useLocation } from 'react-router-dom';
import CoachesNav from './CoachesNav';
import DesktopSidebar from './DesktopSidebar';
import { useSidebar } from '../contexts/SidebarContext';
import { isPublicPath } from '../router/publicPaths';
import ProactiveNotificationsBanner from '../components/ProactiveNotificationsBanner';

export default function AppShell({ children }) {
  const location = useLocation();
  const { collapsed } = useSidebar();
  const publicPath = isPublicPath(location.pathname);

  const pad = collapsed ? 'md:pl-16' : 'md:pl-60';

  return (
    <>
      {!publicPath && (
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:bg-blue-700 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-xl focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:font-semibold focus:no-underline"
        >
          Saltar al contenido principal
        </a>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className={publicPath ? 'outline-none' : `${pad} pb-16 md:pb-0 transition-[padding] duration-200 outline-none`}
      >
        {!publicPath && <ProactiveNotificationsBanner />}
        {children}
      </main>
      {!publicPath && (
        <>
          <CoachesNav />
          <DesktopSidebar />
        </>
      )}
    </>
  );
}
