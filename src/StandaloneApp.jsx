import React, { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import LoadingScreen from './screens/LoadingScreen';
import LoginScreen from './screens/LoginScreen';
import PlayoffCreatorModule from './PlayoffCreatorModule';

// Wrapper standalone: gestiona auth y extrae el share code de window.location.
// Cuando PlayoffCreatorModule se integre en una app padre, este archivo
// será reemplazado por el shell de esa app (CoachesApp + AppRouter).
export default function StandaloneApp() {
  const { user, authReady, isLoggingIn, authError, handleLogin, handleAnonymousLogin } = useAuth();

  // Extrae el share code de la URL (ej: /s/ABC123)
  const [initialShareCode] = useState(() => {
    const m = window.location.pathname.match(/^\/s\/([A-Z0-9]{4,12})$/i);
    return m ? m[1].toUpperCase() : null;
  });

  const handleShareCodeConsumed = () => {
    window.history.replaceState({}, '', '/');
  };

  const shareUrlBase = `${window.location.origin}/s`;

  if (!authReady) return <LoadingScreen />;

  if (!user) return (
    <LoginScreen
      errorMsg={authError}
      isLoggingIn={isLoggingIn}
      handleLogin={handleLogin}
      handleAnonymousLogin={handleAnonymousLogin}
    />
  );

  return (
    <PlayoffCreatorModule
      initialShareCode={initialShareCode}
      onShareCodeConsumed={handleShareCodeConsumed}
      shareUrlBase={shareUrlBase}
    />
  );
}
