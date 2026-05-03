import React from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import CoachesNav from './CoachesNav';
import DesktopSidebar from './DesktopSidebar';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { isPublicPath } from '../router/publicPaths';
import ProactiveNotificationsBanner from '../components/ProactiveNotificationsBanner';
import { QuotaExceededModal } from '../billing/components/QuotaExceededModal';
import { PaymentFailedBanner } from '../billing/components/PaymentFailedBanner';

function WorkspaceLoadingState() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 size={48} className="text-blue-600 animate-spin" aria-hidden="true" />
    </div>
  );
}

function WorkspaceProvisioningState({ onLogout }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900 mb-3">Estamos preparando tu espacio de trabajo…</h1>
        <p className="text-slate-600 text-sm leading-relaxed mb-6">
          Estamos preparando tu cuenta. Si esto persiste, contacta con soporte.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const location = useLocation();
  const { collapsed } = useSidebar();
  const { user, handleLogout } = useAuth();
  const { isLoading: workspaceLoading, memberships } = useWorkspace();
  const publicPath = isPublicPath(location.pathname);

  const pad = collapsed ? 'md:pl-16' : 'md:pl-60';

  // Workspace guard: only applies to authenticated private routes.
  // Public routes (landing, /ayuda, /login, /s/:code) bypass this guard so the
  // brand-register surfaces still render even before memberships resolve.
  if (!publicPath && user) {
    if (workspaceLoading) {
      return <WorkspaceLoadingState />;
    }
    if (!memberships || memberships.length === 0) {
      return <WorkspaceProvisioningState onLogout={handleLogout} />;
    }
  }

  return (
    <>
      {!publicPath && (
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:bg-blue-700 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-xl focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:font-semibold focus:no-underline print:hidden"
        >
          Saltar al contenido principal
        </a>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className={
          publicPath
            ? 'outline-none'
            : `${pad} pb-16 md:pb-0 transition-[padding] duration-200 outline-none print:!p-0 print:!m-0`
        }
      >
        {!publicPath && <PaymentFailedBanner />}
        {!publicPath && <ProactiveNotificationsBanner />}
        {children}
      </main>
      {!publicPath && (
        <>
          <CoachesNav />
          <DesktopSidebar />
        </>
      )}
      <QuotaExceededModal />
    </>
  );
}
