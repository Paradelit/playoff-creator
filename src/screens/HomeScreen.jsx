import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Settings,
  BookOpen,
  ShieldHalf,
  ClipboardList,
  CalendarDays,
  Trophy,
  Users,
  ChevronRight,
  Plus,
  FolderOpen,
  ArrowRight,
  Clock,
  History,
  FastForward,
} from 'lucide-react';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { saveTraining } from '../services/trainingsService';
import { useTeams } from '../hooks/useTeams';
import { subscribeToCalendarSessions, linkTrainingToSession } from '../services/calendarService';
import { userColRef } from '../services/firestoreHelpers';
import { teamDisplayName } from './TeamsScreen';
import { buildPlayoffSessions } from '../utils/calendarUtils';
import { isMinibasketSextos } from '../utils/minibasketUtils';
import { toYMD } from '../utils/dateUtils';

function getExtendedRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 14);
  const end = new Date(now);
  end.setDate(now.getDate() + 14);
  return { startStr: toYMD(start), endStr: toYMD(end) };
}

function findTeamCurrentMatch(bracketData, myTeam) {
  if (!bracketData?.state || !myTeam) return null;
  return Object.values(bracketData.state).find((m) => !m.winner && (m.team1 === myTeam || m.team2 === myTeam));
}

function getSeriesScore(match, myTeam) {
  if (!match?.scores) return null;
  let wins = 0;
  let losses = 0;
  for (const g of match.scores) {
    const s1 = Number(g.s1);
    const s2 = Number(g.s2);
    if (!s1 && !s2) continue;
    const isTeam1 = match.team1 === myTeam;
    if ((isTeam1 && s1 > s2) || (!isTeam1 && s2 > s1)) wins++;
    else if (s1 !== s2) losses++;
  }
  if (!wins && !losses) return null;
  return { wins, losses, total: match.gamesCount || 1 };
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const CARD_GRADIENTS = [
  'from-blue-900 via-blue-800 to-blue-700',
  'from-blue-800 via-blue-700 to-blue-600',
  'from-orange-700 via-orange-600 to-orange-500',
  'from-slate-800 via-slate-700 to-slate-600',
  'from-amber-700 via-amber-600 to-amber-500',
  'from-blue-950 via-blue-900 to-blue-800',
];

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 group" type="button">
      <div className="w-12 h-12 bg-white/15 group-hover:bg-white/25 group-active:bg-white/30 rounded-full flex items-center justify-center transition-colors">
        <Icon size={20} className="text-white" />
      </div>
      <span className="text-xs text-blue-100 font-medium whitespace-nowrap">{label}</span>
    </button>
  );
}

export default function HomeScreen() {
  const { user, handleLogout } = useAuth();
  const { db, appId } = useFirebase();
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const cardRefs = useRef([]);

  const { teams, loading: loadingTeams } = useTeams();
  const [sessions, setSessions] = useState([]);
  const [brackets, setBrackets] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [creatingTraining, setCreatingTraining] = useState(null); // sessionId being created

  const displayName = user?.isAnonymous ? 'Invitado' : user?.displayName || user?.email?.split('@')[0] || 'Entrenador';
  const photoURL = user?.photoURL || null;
  const initial = displayName.charAt(0).toUpperCase();

  const today = useMemo(() => new Date(), []);
  const todayYMD = useMemo(() => toYMD(today), [today]);
  const { startStr, endStr } = useMemo(() => getExtendedRange(), []);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToCalendarSessions(user.uid, db, appId, startStr, endStr, setSessions);
  }, [user, db, appId, startStr, endStr]);

  useEffect(() => {
    if (!user || !db) return;
    return onSnapshot(userColRef(db, appId, user.uid, 'brackets'), (snap) => {
      setBrackets(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
    });
  }, [user, db, appId]);

  useEffect(() => {
    if (!carouselRef.current || teams.length === 0) return;
    const observers = teams.map((_, i) => {
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveIdx(i);
        },
        { threshold: 0.6, root: carouselRef.current },
      );
      if (cardRefs.current[i]) obs.observe(cardRefs.current[i]);
      return obs;
    });
    return () => observers.forEach((obs) => obs.disconnect());
  }, [teams]);

  // Merge calendar sessions + playoff virtual sessions
  const playoffSessions = useMemo(() => buildPlayoffSessions(brackets, teams), [brackets, teams]);
  const allSessions = useMemo(() => [...sessions, ...playoffSessions], [sessions, playoffSessions]);

  // TODAY's events
  const todayEvents = useMemo(
    () =>
      allSessions
        .filter((s) => s.fecha === todayYMD)
        .sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || '')),
    [allSessions, todayYMD],
  );

  // LAST event per team (before today)
  const lastEventByTeam = useMemo(() => {
    const past = allSessions
      .filter((s) => s.fecha < todayYMD && s.teamId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.horaInicio || '').localeCompare(a.horaInicio || ''));
    const seen = new Set();
    const result = [];
    for (const s of past) {
      if (seen.has(s.teamId)) continue;
      seen.add(s.teamId);
      result.push(s);
    }
    return result;
  }, [allSessions, todayYMD]);

  // NEXT event per team (after today)
  const nextEventByTeam = useMemo(() => {
    const future = allSessions
      .filter((s) => s.fecha > todayYMD && s.teamId)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.horaInicio || '').localeCompare(b.horaInicio || ''));
    const seen = new Set();
    const result = [];
    for (const s of future) {
      if (seen.has(s.teamId)) continue;
      seen.add(s.teamId);
      result.push(s);
    }
    return result;
  }, [allSessions, todayYMD]);

  // Active playoffs (keep for extra info)
  const activePlayoffs = useMemo(() => {
    const teamIds = new Set(teams.map((t) => t.id));
    return brackets
      .filter((b) => b.teamId && teamIds.has(b.teamId) && b.bracketData)
      .map((b) => {
        const match = findTeamCurrentMatch(b.bracketData, b.myTeam);
        const rival = match ? (match.team1 === b.myTeam ? match.team2 : match.team1) : null;
        const series = match ? getSeriesScore(match, b.myTeam) : null;
        const team = teams.find((t) => t.id === b.teamId);
        return {
          id: b.id,
          name: b.name || b.tournamentNameDetected || 'Playoff',
          teamName: team ? teamDisplayName(team) : '',
          teamId: b.teamId,
          match,
          rival,
          series,
          title: match?.title,
        };
      });
  }, [brackets, teams]);

  const handleCreateTraining = useCallback(
    async (session) => {
      setCreatingTraining(session.id);
      try {
        const trainingId = crypto.randomUUID();
        await saveTraining(
          {
            id: trainingId,
            teamId: session.teamId,
            meta: {
              numero: session.sessionNumber,
              fecha: session.fecha,
              horaInicio: session.horaInicio,
              horaFin: session.horaFin,
              lugar: session.lugar || '',
              dia: '',
              equipo: session.teamName || '',
            },
            objetivos: '',
            ejercicios: [],
            cierre: { faltas: '', retrasos: '', anotaciones: '', observaciones: '' },
          },
          session.teamId,
          { uid: user.uid, db, appId },
        );
        await linkTrainingToSession(session.id, trainingId, { uid: user.uid, db, appId });
        navigate(`/teams/${session.teamId}/trainings/${trainingId}`);
      } finally {
        setCreatingTraining(null);
      }
    },
    [user, db, appId, navigate],
  );

  const handleEventAction = useCallback(
    (session) => {
      if (session.tipo === 'playoff') {
        const team = teams.find((t) => t.id === session.teamId);
        if (isMinibasketSextos(team)) {
          navigate(`/calendar/${session.id}/planilla`, {
            state: { playoffSession: session },
          });
        } else {
          navigate(`/playoffs?teamId=${session.teamId}`);
        }
      } else if (session.tipo === 'entrenamiento') {
        if (session.trainingId) {
          navigate(`/teams/${session.teamId}/trainings/${session.trainingId}`);
        } else {
          handleCreateTraining(session);
        }
      } else if (session.tipo === 'partido') {
        const team = teams.find((t) => t.id === session.teamId);
        if (isMinibasketSextos(team)) {
          navigate(`/calendar/${session.id}/planilla`);
        } else if (session.fecha < todayYMD) {
          navigate(`/calendar/${session.id}/analysis`);
        } else {
          navigate(`/calendar/${session.id}/scouting`);
        }
      }
    },
    [navigate, teams, handleCreateTraining, todayYMD],
  );

  const hora = today.getHours();
  const greeting = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-28 overflow-x-hidden">
      {/* Header */}
      <div className="bg-gradient-to-b from-blue-950 via-blue-950 to-blue-900 px-5 pt-10 pb-32">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div>
            <p className="text-blue-400 text-sm font-medium">{greeting}</p>
            <h1 className="text-white text-2xl font-bold leading-tight">{displayName}</h1>
          </div>
          <div className="flex items-center gap-2">
            {photoURL ? (
              <img src={photoURL} alt="Avatar" className="w-9 h-9 rounded-full border-2 border-blue-700" />
            ) : (
              <div className="w-9 h-9 bg-blue-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {initial}
              </div>
            )}
            <button
              onClick={() => navigate('/exercises')}
              className="text-blue-400 hover:text-white transition p-1.5"
              aria-label="Biblioteca de ejercicios"
              title="Biblioteca de ejercicios"
            >
              <BookOpen size={18} />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="text-blue-400 hover:text-white transition p-1.5"
              aria-label="Ajustes"
              title="Ajustes"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={handleLogout}
              className="text-blue-400 hover:text-white transition p-1.5"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">
        {/* Team carousel */}
        <div className="-mt-24 mb-4">
          {loadingTeams ? (
            <div className="h-48 bg-white/10 rounded-2xl animate-pulse" />
          ) : teams.length === 0 ? (
            <EmptyTeamCard navigate={navigate} />
          ) : (
            <>
              <div
                ref={carouselRef}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {teams.map((team, idx) => (
                  <div
                    key={team.id}
                    ref={(el) => (cardRefs.current[idx] = el)}
                    className={`snap-center flex-shrink-0 w-[calc(100vw-48px)] max-w-sm bg-gradient-to-br ${CARD_GRADIENTS[idx % CARD_GRADIENTS.length]} rounded-2xl p-5 text-white shadow-2xl`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest">
                          {team.categoria}
                          {team.genero ? ` · ${team.genero}` : ''}
                        </p>
                        <h2 className="text-xl font-bold mt-0.5 leading-tight">{teamDisplayName(team)}</h2>
                      </div>
                      <ShieldHalf size={22} className="text-white/30 shrink-0 mt-0.5" />
                    </div>

                    <div className="w-12 h-0.5 bg-white/20 rounded-full my-4" />

                    <div className="flex gap-5">
                      <QuickAction icon={Users} label="Plantilla" onClick={() => navigate(`/teams/${team.id}`)} />
                      <QuickAction
                        icon={ClipboardList}
                        label="Cuaderno"
                        onClick={() => navigate(`/teams/${team.id}/cuaderno`)}
                      />
                      <QuickAction
                        icon={CalendarDays}
                        label="Calendario"
                        onClick={() => navigate(`/calendar?teamId=${team.id}`)}
                      />
                      <QuickAction
                        icon={Trophy}
                        label="Playoffs"
                        onClick={() => navigate(`/playoffs?teamId=${team.id}`)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {teams.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-1">
                  {teams.map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-full transition-all duration-300 ${i === activeIdx ? 'w-5 h-1.5 bg-blue-600' : 'w-1.5 h-1.5 bg-slate-300'}`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* HOY */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Clock size={13} /> Hoy
            </h2>
            <button
              onClick={() => navigate('/calendar')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
            >
              Calendario →
            </button>
          </div>

          {todayEvents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
              <CalendarDays size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm font-medium">Sin eventos hoy</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {todayEvents.map((s) => (
                <ActionEventRow
                  key={s.id}
                  session={s}
                  onAction={() => handleEventAction(s)}
                  creating={creatingTraining === s.id}
                  teams={teams}
                  variant="today"
                />
              ))}
            </div>
          )}
        </div>

        {/* LO ÚLTIMO */}
        {lastEventByTeam.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <History size={13} /> Lo último
            </h2>
            <div className="flex flex-col gap-2">
              {lastEventByTeam.map((s) => (
                <ActionEventRow
                  key={s.id}
                  session={s}
                  onAction={() => handleEventAction(s)}
                  creating={creatingTraining === s.id}
                  teams={teams}
                  variant="past"
                />
              ))}
            </div>
          </div>
        )}

        {/* PRÓXIMAMENTE */}
        {nextEventByTeam.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <FastForward size={13} /> Próximamente
            </h2>
            <div className="flex flex-col gap-2">
              {nextEventByTeam.map((s) => (
                <ActionEventRow
                  key={s.id}
                  session={s}
                  onAction={() => handleEventAction(s)}
                  creating={creatingTraining === s.id}
                  teams={teams}
                  variant="future"
                />
              ))}
            </div>
          </div>
        )}

        {/* Playoffs activos */}
        {activePlayoffs.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Playoffs</h2>
            <div className="flex flex-col gap-2">
              {activePlayoffs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/playoffs?teamId=${p.teamId}`)}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3 hover:shadow-md transition-shadow text-left w-full"
                >
                  <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Trophy size={20} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {p.teamName}
                      {p.title ? ` · ${p.title}` : ''}
                    </p>
                    {p.match && p.rival ? (
                      <p className="text-xs font-bold text-indigo-600 mt-0.5">
                        vs {p.rival}
                        {p.series ? ` (${p.series.wins}-${p.series.losses})` : ''}
                      </p>
                    ) : !p.match ? (
                      <p className="text-xs text-emerald-600 font-bold mt-0.5">Eliminatoria finalizada</p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-0.5">Esperando rival...</p>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyTeamCard({ navigate }) {
  return (
    <div className="w-full bg-gradient-to-br from-blue-900 to-blue-700 rounded-2xl p-6 text-white shadow-2xl flex flex-col items-center justify-center text-center min-h-[180px] gap-3">
      <FolderOpen size={36} className="text-blue-400" />
      <p className="text-blue-100 font-semibold">Aún no tienes equipos</p>
      <button
        onClick={() => navigate('/teams')}
        className="bg-white/15 hover:bg-white/25 text-white font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-2 transition"
      >
        <Plus size={16} /> Crear equipo
      </button>
    </div>
  );
}

function getActionLabel(session, teams) {
  if (session.tipo === 'playoff') {
    const team = teams.find((t) => t.id === session.teamId);
    if (isMinibasketSextos(team)) return 'Planilla de sextos';
    return 'Ver cuadro';
  }
  if (session.tipo === 'entrenamiento') return session.trainingId ? 'Abrir entrenamiento' : 'Crear entrenamiento';
  if (session.tipo === 'partido') {
    const team = teams.find((t) => t.id === session.teamId);
    if (isMinibasketSextos(team)) return 'Planilla de sextos';
    return session.fecha < toYMD(new Date()) ? 'Ver análisis' : 'Scouting';
  }
  return 'Ver';
}

function getEventIcon(session) {
  if (session.tipo === 'playoff') return { bg: 'bg-amber-100', color: 'text-amber-600', Icon: Trophy };
  if (session.tipo === 'partido') return { bg: 'bg-rose-100', color: 'text-rose-600', Icon: Trophy };
  return { bg: 'bg-blue-100', color: 'text-blue-600', Icon: ClipboardList };
}

function ActionEventRow({ session, onAction, creating, teams, variant }) {
  const { bg, color, Icon } = getEventIcon(session);
  const actionLabel = getActionLabel(session, teams);
  const isCreating = creating;

  const actionColors = {
    playoff: 'bg-amber-500 hover:bg-amber-600',
    partido: 'bg-rose-500 hover:bg-rose-600',
    entrenamiento: 'bg-blue-600 hover:bg-blue-700',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3 w-full">
      {/* Date badge */}
      <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${bg}`}>
        <span className={`text-xs font-bold uppercase ${color}`}>
          {session.fecha ? MONTHS[parseInt(session.fecha.split('-')[1]) - 1] : ''}
        </span>
        <span className={`text-lg font-black leading-none ${color}`}>
          {session.fecha ? parseInt(session.fecha.split('-')[2]) : ''}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm truncate">
          {session.tipo === 'playoff'
            ? `${session.bracketName} · ${session.matchTitle}`
            : session.tipo === 'partido'
              ? `vs ${session.rival || 'Rival'} ${session.esLocal ? '(L)' : '(V)'}`
              : `Entrenamiento #${session.sessionNumber}`}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {session.teamName}
          {session.horaInicio ? ` · ${session.horaInicio}` : ''}
          {session.lugar ? ` · ${session.lugar}` : ''}
        </p>
      </div>

      {/* Action button */}
      <button
        onClick={onAction}
        disabled={isCreating}
        className={`shrink-0 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${actionColors[session.tipo] || 'bg-slate-600 hover:bg-slate-700'} disabled:opacity-60`}
      >
        {isCreating ? (
          '...'
        ) : (
          <>
            {variant === 'past' ? <History size={12} /> : <ArrowRight size={12} />}
            <span className="hidden sm:inline">{actionLabel}</span>
          </>
        )}
      </button>
    </div>
  );
}
