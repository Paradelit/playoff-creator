import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { FirebaseProvider } from '../contexts/FirebaseContext';
import { AuthProvider } from '../contexts/AuthContext';
import { AIProvider } from '../contexts/AIContext';
import { ToastProvider } from '../contexts/ToastContext';
import ErrorBoundary from '../components/ErrorBoundary';
import CoachesNav from './CoachesNav';
import AppRouter from './AppRouter';
import AIChatPanel from '../components/AIChatPanel';

export default function CoachesApp() {
  return (
    <BrowserRouter>
      <FirebaseProvider>
        <AuthProvider>
          <AIProvider>
            <ToastProvider>
              <ErrorBoundary>
                <div className="pb-16">
                  <AppRouter />
                </div>
                <CoachesNav />
                <AIChatPanel />
              </ErrorBoundary>
            </ToastProvider>
          </AIProvider>
        </AuthProvider>
      </FirebaseProvider>
    </BrowserRouter>
  );
}
