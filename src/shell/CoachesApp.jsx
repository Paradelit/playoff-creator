import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { FirebaseProvider } from '../contexts/FirebaseContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ScreenContextProvider } from '../contexts/ScreenContextProvider';
import { PickProvider } from '../contexts/PickProvider';
import { ToastProvider } from '../contexts/ToastContext';
import { SidebarProvider } from '../contexts/SidebarContext';
import ErrorBoundary from '../components/ErrorBoundary';
import AppShell from './AppShell';
import AppRouter from './AppRouter';
import PickRoot from '../components/pick/PickRoot';

export default function CoachesApp() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <FirebaseProvider>
          <AuthProvider>
            <ScreenContextProvider>
              <PickProvider>
                <ToastProvider>
                  <ErrorBoundary>
                    <SidebarProvider>
                      <AppShell>
                        <AppRouter />
                      </AppShell>
                      <PickRoot />
                    </SidebarProvider>
                  </ErrorBoundary>
                </ToastProvider>
              </PickProvider>
            </ScreenContextProvider>
          </AuthProvider>
        </FirebaseProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}
