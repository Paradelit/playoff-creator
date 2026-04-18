import React from 'react';
import { useLocation } from 'react-router-dom';
import CoachesNav from './CoachesNav';
import DesktopSidebar from './DesktopSidebar';

export default function AppShell({ children }) {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
    <>
      <div className={isLogin ? '' : 'md:pl-60 pb-16 md:pb-0'}>{children}</div>
      {!isLogin && (
        <>
          <CoachesNav />
          <DesktopSidebar />
        </>
      )}
    </>
  );
}
