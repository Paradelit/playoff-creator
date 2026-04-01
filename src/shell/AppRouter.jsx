import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';

const TeamsScreen = lazy(() => import('../screens/TeamsScreen'));
const TeamDetailScreen = lazy(() => import('../screens/TeamDetailScreen'));
const TeamTrainingsScreen = lazy(() => import('../screens/TeamTrainingsScreen'));
const TrainingEditorScreen = lazy(() => import('../screens/TrainingEditorScreen'));
const ExerciseLibraryScreen = lazy(() => import('../screens/ExerciseLibraryScreen'));
const CalendarScreen = lazy(() => import('../screens/CalendarScreen'));
const SettingsScreen = lazy(() => import('../screens/SettingsScreen'));
const PlayoffCreatorModule = lazy(() => import('../PlayoffCreatorModule'));
const CuadernoScreen = lazy(() => import('../screens/CuadernoScreen'));
const InfoScreen = lazy(() => import('../screens/cuaderno/InfoScreen'));
const PilaresScreen = lazy(() => import('../screens/cuaderno/PilaresScreen'));
const NormasScreen = lazy(() => import('../screens/cuaderno/NormasScreen'));
const TestTiroScreen = lazy(() => import('../screens/cuaderno/TestTiroScreen'));
const JugadoresScreen = lazy(() => import('../screens/cuaderno/JugadoresScreen'));
const NotasScreen = lazy(() => import('../screens/cuaderno/NotasScreen'));

function LazyFallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 size={48} className="text-blue-600 animate-spin" />
    </div>
  );
}

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
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/playoffs" element={<PlayoffsRoute />} />
        <Route path="/teams" element={<TeamsRoute />} />
        <Route path="/teams/:teamId" element={<TeamDetailRoute />} />
        <Route
          path="/teams/:teamId/cuaderno"
          element={
            <AuthGuard>
              <CuadernoScreen />
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/info"
          element={
            <AuthGuard>
              <InfoScreen />
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/pilares"
          element={
            <AuthGuard>
              <PilaresScreen />
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/normas"
          element={
            <AuthGuard>
              <NormasScreen />
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/test-tiro"
          element={
            <AuthGuard>
              <TestTiroScreen />
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/jugadores"
          element={
            <AuthGuard>
              <JugadoresScreen />
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/notas"
          element={
            <AuthGuard>
              <NotasScreen />
            </AuthGuard>
          }
        />
        <Route path="/teams/:teamId/trainings" element={<TeamTrainingsRoute />} />
        <Route path="/teams/:teamId/trainings/:trainingId" element={<TrainingEditorRoute />} />
        <Route path="/exercises" element={<ExercisesRoute />} />
        <Route path="/calendar" element={<CalendarRoute />} />
        <Route path="/settings" element={<SettingsRoute />} />
        <Route path="/s/:code" element={<ShareRedirect />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
