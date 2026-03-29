import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { FirebaseProvider } from '../contexts/FirebaseContext';
import { AuthProvider } from '../contexts/AuthContext';
import CoachesNav from './CoachesNav';
import AppRouter from './AppRouter';

// Root de la coaches app.
// BrowserRouter vive aquí para que todos los hijos puedan usar hooks de React Router.
// FirebaseProvider y AuthProvider envuelven todo para compartir Firebase y auth.
export default function CoachesApp() {
  return (
    <BrowserRouter>
      <FirebaseProvider>
        <AuthProvider>
          {/* Contenido principal — pb-16 deja espacio sobre la nav inferior fija */}
          <div className="pb-16">
            <AppRouter />
          </div>
          {/* Barra de navegación inferior (fixed, 64px) */}
          <CoachesNav />
        </AuthProvider>
      </FirebaseProvider>
    </BrowserRouter>
  );
}
