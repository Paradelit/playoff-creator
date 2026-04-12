import React, { lazy, Suspense, useEffect } from 'react';
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
const InformeJugadoresScreen = lazy(() => import('../screens/cuaderno/InformeJugadoresScreen'));
const AsistenciaScreen = lazy(() => import('../screens/cuaderno/AsistenciaScreen'));
const PlanillaSextosScreen = lazy(() => import('../screens/PlanillaSextosScreen'));
const ScoutingScreen = lazy(() => import('../screens/ScoutingScreen'));
const AnalysisScreen = lazy(() => import('../screens/AnalysisScreen'));
const EntrenamientosScreen = lazy(() => import('../screens/cuaderno/EntrenamientosScreen'));
const SharedExerciseScreen = lazy(() => import('../screens/SharedExerciseScreen'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function LazyFallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 size={48} className="text-blue-600 animate-spin" />
    </div>
  );
}

function AuthGuard({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function ShareRedirect() {
  const { code } = useParams();
  return <Navigate to={`/playoffs?share=${code}`} replace />;
}

function PlayoffsRoute() {
  const navigate = useNavigate();
  const location = useLocation();

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

function Guarded({ name, children }) {
  return (
    <AuthGuard>
      <ModuleBoundary name={name}>{children}</ModuleBoundary>
    </AuthGuard>
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
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <HomeScreen />
            </AuthGuard>
          }
        />

        <Route
          path="/playoffs"
          element={
            <Guarded name="Playoffs">
              <PlayoffsRoute />
            </Guarded>
          }
        />
        <Route
          path="/teams"
          element={
            <Guarded name="Equipos">
              <TeamsScreen />
            </Guarded>
          }
        />
        <Route
          path="/teams/:teamId"
          element={
            <Guarded name="Equipos">
              <TeamDetailScreen />
            </Guarded>
          }
        />

        <Route
          path="/teams/:teamId/cuaderno"
          element={
            <Guarded name="Cuaderno">
              <CuadernoScreen />
            </Guarded>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/info"
          element={
            <Guarded name="Cuaderno">
              <InfoScreen />
            </Guarded>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/pilares"
          element={
            <Guarded name="Cuaderno">
              <PilaresScreen />
            </Guarded>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/normas"
          element={
            <Guarded name="Cuaderno">
              <NormasScreen />
            </Guarded>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/test-tiro"
          element={
            <Guarded name="Cuaderno">
              <TestTiroScreen />
            </Guarded>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/jugadores"
          element={
            <Guarded name="Cuaderno">
              <JugadoresScreen />
            </Guarded>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/notas"
          element={
            <Guarded name="Cuaderno">
              <NotasScreen />
            </Guarded>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/informe-jugadores"
          element={
            <Guarded name="Cuaderno">
              <InformeJugadoresScreen />
            </Guarded>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/asistencia"
          element={
            <Guarded name="Cuaderno">
              <AsistenciaScreen />
            </Guarded>
          }
        />
        <Route
          path="/teams/:teamId/cuaderno/entrenamientos"
          element={
            <Guarded name="Cuaderno">
              <EntrenamientosScreen />
            </Guarded>
          }
        />

        <Route
          path="/teams/:teamId/trainings"
          element={
            <Guarded name="Entrenamientos">
              <TeamTrainingsScreen />
            </Guarded>
          }
        />
        <Route
          path="/teams/:teamId/trainings/:trainingId"
          element={
            <Guarded name="Entrenamientos">
              <TrainingEditorScreen />
            </Guarded>
          }
        />

        <Route
          path="/exercises"
          element={
            <Guarded name="Ejercicios">
              <ExerciseLibraryScreen />
            </Guarded>
          }
        />
        <Route
          path="/calendar"
          element={
            <Guarded name="Calendario">
              <CalendarScreen />
            </Guarded>
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
        <Route
          path="/calendar/:sessionId/scouting"
          element={
            <Guarded name="Scouting">
              <ScoutingScreen />
            </Guarded>
          }
        />
        <Route
          path="/calendar/:sessionId/analysis"
          element={
            <Guarded name="Análisis">
              <AnalysisScreen />
            </Guarded>
          }
        />
        <Route
          path="/settings"
          element={
            <Guarded name="Ajustes">
              <SettingsScreen />
            </Guarded>
          }
        />

        <Route path="/s/:code" element={<ShareRedirect />} />
        <Route
          path="/exercise/:shareCode"
          element={
            <Suspense fallback={<LazyFallback />}>
              <ModuleBoundary>
                <SharedExerciseScreen />
              </ModuleBoundary>
            </Suspense>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
