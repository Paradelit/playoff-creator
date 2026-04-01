import React, { useEffect, useState, useRef, useMemo } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { subscribeToTeams } from '../services/teamsService';
import { subscribeToCalendarSessions } from '../services/calendarService';
import { teamDisplayName } from './TeamsScreen';

function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Gradientes para las tarjetas de equipo
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

  const [teams, setTeams] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  const displayName = user?.isAnonymous ? 'Invitado' : user?.displayName || user?.email?.split('@')[0] || 'Entrenador';
  const photoURL = user?.photoURL || null;
  const initial = displayName.charAt(0).toUpperCase();

  const today = useMemo(() => new Date(), []);
  const todayYMD = useMemo(() => toYMD(today), [today]);
  const futureYMD = useMemo(() => toYMD(new Date(today.getFullYear(), today.getMonth() + 2, 0)), [today]);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToTeams(user.uid, db, appId, (data) => {
      setTeams(data);
      setLoadingTeams(false);
    });
  }, [user, db, appId]);

  useEffect(() => {
    if (!user || !db) return;
    return subscribeToCalendarSessions(user.uid, db, appId, todayYMD, futureYMD, setSessions);
  }, [user, db, appId, todayYMD, futureYMD]);

  // IntersectionObserver para detectar tarjeta activa
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

  // Próximos eventos ordenados por fecha
  const upcomingEvents = sessions
    .filter((s) => s.fecha >= todayYMD)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.horaInicio || '').localeCompare(b.horaInicio || ''))
    .slice(0, 8);

  const hora = today.getHours();
  const greeting = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-28 overflow-x-hidden">
      {/* ─── Cabecera oscura ─── */}
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
              title="Biblioteca de ejercicios"
            >
              <BookOpen size={18} />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="text-blue-400 hover:text-white transition p-1.5"
              title="Ajustes"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={handleLogout}
              className="text-blue-400 hover:text-white transition p-1.5"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4">
        {/* ─── Carrusel de equipos ─── */}
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

              {/* Indicador de puntos */}
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

        {/* ─── Próximos eventos ─── */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Próximos eventos</h2>
            <button
              onClick={() => navigate('/calendar')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
            >
              Ver todo →
            </button>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
              <CalendarDays size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm font-medium">Sin eventos próximos</p>
              <button
                onClick={() => navigate('/calendar')}
                className="text-blue-600 font-bold text-sm mt-2 hover:underline"
              >
                Planificar en el calendario
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingEvents.map((s) => (
                <EventRow key={s.id} session={s} onClick={() => navigate('/calendar')} />
              ))}
            </div>
          )}
        </div>
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

function EventRow({ session, onClick }) {
  const isPartido = session.tipo === 'partido';
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3 hover:shadow-md transition-shadow text-left w-full"
    >
      {/* Fecha */}
      <div
        className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${isPartido ? 'bg-rose-100' : 'bg-blue-100'}`}
      >
        <span className={`text-xs font-bold uppercase ${isPartido ? 'text-rose-600' : 'text-blue-600'}`}>
          {session.fecha ? MONTHS[parseInt(session.fecha.split('-')[1]) - 1] : ''}
        </span>
        <span className={`text-lg font-black leading-none ${isPartido ? 'text-rose-700' : 'text-blue-700'}`}>
          {session.fecha ? parseInt(session.fecha.split('-')[2]) : ''}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm truncate">
          {isPartido
            ? `vs ${session.rival || 'Rival'} ${session.esLocal ? '(Local)' : '(Visitante)'}`
            : `Entrenamiento #${session.sessionNumber}`}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {session.teamName}
          {session.horaInicio ? ` · ${session.horaInicio}` : ''}
          {session.lugar ? ` · ${session.lugar}` : ''}
        </p>
      </div>

      <ChevronRight size={16} className="text-slate-400 shrink-0" />
    </button>
  );
}
