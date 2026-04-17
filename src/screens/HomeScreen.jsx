import React, { useEffect, useRef, useState } from 'react';
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
  Clock,
  History,
  FastForward,
} from 'lucide-react';
import { useHomeDashboard } from '../hooks/useHomeDashboard';
import { useRegisterScreenContext } from '../hooks/useRegisterScreenContext';
import { teamDisplayName } from '../utils/teamUtils';
import { EmptyTeamCard, MatchDayWidget, ActionEventRow, MONTHS } from '../components/home/HomeComponents';

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
  const {
    user,
    handleLogout,
    navigate,
    teams,
    loadingTeams,
    trainingNumbers,
    today,
    todayYMD,
    todayEvents,
    lastEventByTeam,
    nextEventByTeam,
    activePlayoffs,
    matchDayEvent,
    weeklySummary,
    nextMatchByTeam,
    creatingTraining,
    handleEventAction,
  } = useHomeDashboard();

  useRegisterScreenContext({
    todayEventsCount: todayEvents.length,
    teamsCount: teams.length,
    activePlayoffsCount: activePlayoffs.length,
  });

  const carouselRef = useRef(null);
  const cardRefs = useRef([]);
  const [activeIdx, setActiveIdx] = useState(0);

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

  const displayName = user?.isAnonymous ? 'Invitado' : user?.displayName || user?.email?.split('@')[0] || 'Entrenador';
  const photoURL = user?.photoURL || null;
  const initial = displayName.charAt(0).toUpperCase();
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
                    {nextMatchByTeam[team.id] && (
                      <p className="text-xs text-blue-200/80 mt-2 truncate">
                        Próx. partido: vs {nextMatchByTeam[team.id].rival || 'Rival'} —{' '}
                        {(() => {
                          const f = nextMatchByTeam[team.id].fecha;
                          return `${parseInt(f.split('-')[2])} ${MONTHS[parseInt(f.split('-')[1]) - 1]}`;
                        })()}
                      </p>
                    )}
                    {activePlayoffs.find((p) => p.teamId === team.id && p.rival) && (
                      <p className="text-xs text-amber-300/80 mt-0.5 truncate">
                        Torneo: vs {activePlayoffs.find((p) => p.teamId === team.id && p.rival).rival}
                        {(() => {
                          const p = activePlayoffs.find((ap) => ap.teamId === team.id && ap.rival);
                          return p?.series ? ` (${p.series.wins}-${p.series.losses})` : '';
                        })()}
                      </p>
                    )}
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
                        label="Torneos"
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

        {matchDayEvent && (
          <MatchDayWidget session={matchDayEvent} teams={teams} todayYMD={todayYMD} navigate={navigate} />
        )}

        {weeklySummary.total > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2.5 flex items-center gap-2 text-xs text-slate-600 font-medium">
            <CalendarDays size={14} className="text-slate-400 shrink-0" />
            <span>Esta semana:</span>
            {weeklySummary.entrenamientos > 0 && (
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                {weeklySummary.entrenamientos} entren.
              </span>
            )}
            {weeklySummary.partidos > 0 && (
              <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">
                {weeklySummary.partidos} {weeklySummary.partidos === 1 ? 'partido' : 'partidos'}
              </span>
            )}
            {weeklySummary.playoffs > 0 && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                {weeklySummary.playoffs} torneo
              </span>
            )}
          </div>
        )}

        {/* Today */}
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
                  trainingNumbers={trainingNumbers}
                  variant="today"
                />
              ))}
            </div>
          )}
        </div>

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
                  trainingNumbers={trainingNumbers}
                  variant="past"
                />
              ))}
            </div>
          </div>
        )}

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
                  trainingNumbers={trainingNumbers}
                  variant="future"
                />
              ))}
            </div>
          </div>
        )}

        {activePlayoffs.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Torneos</h2>
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
