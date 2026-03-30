import React from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import TeamsScreen from '../screens/TeamsScreen';
import TeamDetailScreen from '../screens/TeamDetailScreen';
import TeamTrainingsScreen from '../screens/TeamTrainingsScreen';
import TrainingEditorScreen from '../screens/TrainingEditorScreen';
import ExerciseLibraryScreen from '../screens/ExerciseLibraryScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PlayoffCreatorModule from '../PlayoffCreatorModule';
import CuadernoScreen from '../screens/CuadernoScreen';
import InfoScreen from '../screens/cuaderno/InfoScreen';
import PilaresScreen from '../screens/cuaderno/PilaresScreen';
import NormasScreen from '../screens/cuaderno/NormasScreen';
import TestTiroScreen from '../screens/cuaderno/TestTiroScreen';
import JugadoresScreen from '../screens/cuaderno/JugadoresScreen';
import NotasScreen from '../screens/cuaderno/NotasScreen';

// Guard genérico para rutas autenticadas
function AuthGuard({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

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

  const params = new URLSearchParams(location.search);
  const shareCode = params.get('share') || undefined;
  const initialTeamId = params.get('teamId') || undefined;

  return (
    <PlayoffCreatorModule
      initialShareCode={shareCode}
      initialTeamId={initialTeamId}
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

// Ruta /teams/:teamId/trainings
function TeamTrainingsRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <TeamTrainingsScreen />;
}

// Ruta /teams/:teamId/trainings/:trainingId
function TrainingEditorRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <TrainingEditorScreen />;
}

// Ruta /exercises
function ExercisesRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <ExerciseLibraryScreen />;
}

// Ruta /calendar
function CalendarRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <CalendarScreen />;
}

// Ruta /settings
function SettingsRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <SettingsScreen />;
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
      <Route path="/teams/:teamId/cuaderno" element={<AuthGuard><CuadernoScreen /></AuthGuard>} />
      <Route path="/teams/:teamId/cuaderno/info" element={<AuthGuard><InfoScreen /></AuthGuard>} />
      <Route path="/teams/:teamId/cuaderno/pilares" element={<AuthGuard><PilaresScreen /></AuthGuard>} />
      <Route path="/teams/:teamId/cuaderno/normas" element={<AuthGuard><NormasScreen /></AuthGuard>} />
      <Route path="/teams/:teamId/cuaderno/test-tiro" element={<AuthGuard><TestTiroScreen /></AuthGuard>} />
      <Route path="/teams/:teamId/cuaderno/jugadores" element={<AuthGuard><JugadoresScreen /></AuthGuard>} />
      <Route path="/teams/:teamId/cuaderno/notas" element={<AuthGuard><NotasScreen /></AuthGuard>} />
      <Route path="/teams/:teamId/trainings" element={<TeamTrainingsRoute />} />
      <Route path="/teams/:teamId/trainings/:trainingId" element={<TrainingEditorRoute />} />
      <Route path="/exercises" element={<ExercisesRoute />} />
      <Route path="/calendar" element={<CalendarRoute />} />
      <Route path="/settings" element={<SettingsRoute />} />
      <Route path="/s/:code" element={<ShareRedirect />} />
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
