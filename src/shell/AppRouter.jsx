import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ModuleBoundary from '../components/ModuleBoundary';
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
const PlanillaSextosScreen = lazy(() => import('../screens/PlanillaSextosScreen'));
const EntrenamientosScreen = lazy(() => import('../screens/cuaderno/EntrenamientosScreen'));

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
  const { authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/playoffs"
          element={
            <ModuleBoundary name="Playoffs">
              <PlayoffsRoute />
            </ModuleBoundary>
          }
        />
        <Route
          path="/teams"
          element={
            <ModuleBoundary name="Equipos">
              <TeamsRoute />
            </ModuleBoundary>
          }
        />
        <Route
          path="/teams/:teamId"
          element={
            <ModuleBoundary name="Equipos">
              <TeamDetailRoute />
            </ModuleBoundary>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno"
          element={
            <AuthGuard>
              <ModuleBoundary name="Cuaderno">
                <CuadernoScreen />
              </ModuleBoundary>
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/info"
          element={
            <AuthGuard>
              <ModuleBoundary name="Cuaderno">
                <InfoScreen />
              </ModuleBoundary>
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/pilares"
          element={
            <AuthGuard>
              <ModuleBoundary name="Cuaderno">
                <PilaresScreen />
              </ModuleBoundary>
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/normas"
          element={
            <AuthGuard>
              <ModuleBoundary name="Cuaderno">
                <NormasScreen />
              </ModuleBoundary>
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/test-tiro"
          element={
            <AuthGuard>
              <ModuleBoundary name="Cuaderno">
                <TestTiroScreen />
              </ModuleBoundary>
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/jugadores"
          element={
            <AuthGuard>
              <ModuleBoundary name="Cuaderno">
                <JugadoresScreen />
              </ModuleBoundary>
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/notas"
          element={
            <AuthGuard>
              <ModuleBoundary name="Cuaderno">
                <NotasScreen />
              </ModuleBoundary>
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/entrenamientos"
          element={
            <AuthGuard>
              <ModuleBoundary name="Cuaderno">
                <EntrenamientosScreen />
              </ModuleBoundary>
            </AuthGuard>
          }
        />
        <Route
          path="/teams/:teamId/trainings"
          element={
            <ModuleBoundary name="Entrenamientos">
              <TeamTrainingsRoute />
            </ModuleBoundary>
          }
        />
        <Route
          path="/teams/:teamId/trainings/:trainingId"
          element={
            <ModuleBoundary name="Entrenamientos">
              <TrainingEditorRoute />
            </ModuleBoundary>
          }
        />
        <Route
          path="/exercises"
          element={
            <ModuleBoundary name="Ejercicios">
              <ExercisesRoute />
            </ModuleBoundary>
          }
        />
        <Route
          path="/calendar"
          element={
            <ModuleBoundary name="Calendario">
              <CalendarRoute />
            </ModuleBoundary>
          }
        />
        <Route
          path="/calendar/:sessionId/planilla"
          element={
            <AuthGuard>
              <PlanillaSextosScreen />
            </AuthGuard>
          }
        />
        <Route path="/settings" element={<SettingsRoute />} />
        <Route path="/s/:code" element={<ShareRedirect />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
