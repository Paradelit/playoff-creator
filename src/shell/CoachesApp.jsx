import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { FirebaseProvider } from '../contexts/FirebaseContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastProvider } from '../contexts/ToastContext';
import ErrorBoundary from '../components/ErrorBoundary';
import CoachesNav from './CoachesNav';
import AppRouter from './AppRouter';

export default function CoachesApp() {
  return (
    <BrowserRouter>
      <FirebaseProvider>
        <AuthProvider>
          <ToastProvider>
            <ErrorBoundary>
              <div className="pb-16">
                <AppRouter />
              </div>
              <CoachesNav />
            </ErrorBoundary>
          </ToastProvider>
        </AuthProvider>
      </FirebaseProvider>
    </BrowserRouter>
  );
}
