import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { FirebaseProvider } from '../contexts/FirebaseContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ScreenContextProvider } from '../contexts/ScreenContextProvider';
import { CopilotProvider } from '../contexts/CopilotProvider';
import { ToastProvider } from '../contexts/ToastContext';
import ErrorBoundary from '../components/ErrorBoundary';
import AppShell from './AppShell';
import AppRouter from './AppRouter';
import CopilotRoot from '../components/copilot/CopilotRoot';

export default function CoachesApp() {
  return (
    <BrowserRouter>
      <FirebaseProvider>
        <AuthProvider>
          <ScreenContextProvider>
            <CopilotProvider>
              <ToastProvider>
                <ErrorBoundary>
                  <AppShell>
                    <AppRouter />
                  </AppShell>
                  <CopilotRoot />
                </ErrorBoundary>
              </ToastProvider>
            </CopilotProvider>
          </ScreenContextProvider>
        </AuthProvider>
      </FirebaseProvider>
    </BrowserRouter>
  );
}
