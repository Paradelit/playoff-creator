import React from 'react';
import { useLocation } from 'react-router-dom';
import CoachesNav from './CoachesNav';
import DesktopSidebar from './DesktopSidebar';
import { useSidebar } from '../contexts/SidebarContext';

export default function AppShell({ children }) {
  const location = useLocation();
  const { collapsed } = useSidebar();
  const isLogin = location.pathname === '/login';

  const pad = collapsed ? 'md:pl-16' : 'md:pl-60';

  return (
    <>
      <div className={isLogin ? '' : `${pad} pb-16 md:pb-0 transition-[padding] duration-200`}>{children}</div>
      {!isLogin && (
        <>
          <CoachesNav />
          <DesktopSidebar />
        </>
      )}
    </>
  );
}
