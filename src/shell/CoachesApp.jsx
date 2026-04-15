import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { FirebaseProvider } from '../contexts/FirebaseContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ScreenContextProvider } from '../contexts/ScreenContextProvider';
import { CopilotProvider } from '../contexts/CopilotProvider';
import { ToastProvider } from '../contexts/ToastContext';
import ErrorBoundary from '../components/ErrorBoundary';
import CoachesNav from './CoachesNav';
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
                  <div className="pb-16">
                    <AppRouter />
                  </div>
                  <CoachesNav />
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
