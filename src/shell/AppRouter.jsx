import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import TeamsScreen from '../screens/TeamsScreen';
import TeamDetailScreen from '../screens/TeamDetailScreen';
import PlayoffCreatorModule from '../PlayoffCreatorModule';

// Ruta /s/:code — extrae el share code y redirige al módulo de playoffs
function ShareRedirect() {
  const { code } = useParams();
  return <Navigate to={`/playoffs?share=${code}`} replace />;
}

// Ruta /playoffs — conecta React Router con el módulo de playoffs
function PlayoffsRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace />;

  const shareCode = new URLSearchParams(location.search).get('share') || undefined;

  return (
    <PlayoffCreatorModule
      initialShareCode={shareCode}
      onShareCodeConsumed={() => navigate('/playoffs', { replace: true })}
      shareUrlBase={`${window.location.origin}/s`}
    />
  );
}

// Ruta /teams/:teamId
function TeamDetailRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <TeamDetailScreen />;
}

// Ruta /teams
function TeamsRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <TeamsScreen />;
}

// Ruta /
function HomeRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <HomeScreen />;
}

// Ruta /login
function LoginRoute() {
  const { user, isLoggingIn, authError, handleLogin, handleAnonymousLogin } = useAuth();

  if (user) return <Navigate to="/" replace />;

  return (
    <LoginScreen
      errorMsg={authError}
      isLoggingIn={isLoggingIn}
      handleLogin={handleLogin}
      handleAnonymousLogin={handleAnonymousLogin}
    />
  );
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/playoffs" element={<PlayoffsRoute />} />
      <Route path="/teams" element={<TeamsRoute />} />
      <Route path="/teams/:teamId" element={<TeamDetailRoute />} />
      <Route path="/s/:code" element={<ShareRedirect />} />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
