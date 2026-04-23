import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LogOut,
  Settings,
  ShieldHalf,
  ClipboardList,
  CalendarDays,
  Trophy,
  Users,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { useHomeDashboard } from '../hooks/useHomeDashboard';
import { useRegisterScreenContext } from '../hooks/useRegisterScreenContext';
import { teamDisplayName } from '../utils/teamUtils';
import { EmptyTeamCard, ActionEventRow, MONTHS } from '../components/home/HomeComponents';
import BibliotecaPreview from '../components/home/BibliotecaPreview';
import NextActionHero from '../components/home/NextActionHero';
import PendingActionsList from '../components/home/PendingActionsList';
import NewsFeed from '../components/home/NewsFeed';
import WeekStrip from '../components/home/WeekStrip';

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

function TeamCard({ team, idx, nextMatch, activePlayoff, navigate }) {
  return (
    <div
      className={`flex-shrink-0 bg-gradient-to-br ${CARD_GRADIENTS[idx % CARD_GRADIENTS.length]} rounded-2xl p-5 text-white shadow-2xl`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="min-w-0">
          <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest truncate">
            {team.categoria}
            {team.genero ? ` · ${team.genero}` : ''}
          </p>
          <h2 className="text-xl font-bold mt-0.5 leading-tight truncate">{teamDisplayName(team)}</h2>
        </div>
        <ShieldHalf size={22} className="text-white/30 shrink-0 mt-0.5" aria-hidden="true" />
      </div>
      {nextMatch && (
        <p className="text-xs text-blue-200/80 mt-2 truncate">
          Próx. partido: vs {nextMatch.rival || 'Rival'} —{' '}
          {(() => {
            const f = nextMatch.fecha;
            return `${parseInt(f.split('-')[2])} ${MONTHS[parseInt(f.split('-')[1]) - 1]}`;
          })()}
        </p>
      )}
      {activePlayoff && activePlayoff.rival && (
        <p className="text-xs text-amber-300/80 mt-0.5 truncate">
          Torneo: vs {activePlayoff.rival}
          {activePlayoff.series ? ` (${activePlayoff.series.wins}-${activePlayoff.series.losses})` : ''}
        </p>
      )}
      <div className="w-12 h-0.5 bg-white/20 rounded-full my-4" />
      <div className="flex gap-5">
        <QuickAction icon={Users} label="Plantilla" onClick={() => navigate(`/teams/${team.id}`)} />
        <QuickAction icon={ClipboardList} label="Cuaderno" onClick={() => navigate(`/teams/${team.id}/cuaderno`)} />
        <QuickAction icon={CalendarDays} label="Calendario" onClick={() => navigate(`/calendar?teamId=${team.id}`)} />
        <QuickAction icon={Trophy} label="Torneos" onClick={() => navigate(`/playoffs?teamId=${team.id}`)} />
      </div>
    </div>
  );
}

function TeamsSection({
  teams,
  loadingTeams,
  nextMatchByTeam,
  activePlayoffs,
  navigate,
  carouselRef,
  cardRefs,
  activeIdx,
}) {
  if (loadingTeams) return <div className="h-48 bg-white/10 rounded-2xl animate-pulse" />;
  if (teams.length === 0) return <EmptyTeamCard navigate={navigate} />;
  return (
    <>
      <div
        ref={carouselRef}
        className="flex md:hidden gap-4 overflow-x-auto snap-x snap-mandatory pb-3"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {teams.map((team, idx) => (
          <div
            key={team.id}
            ref={(el) => (cardRefs.current[idx] = el)}
            className="snap-center flex-shrink-0 w-[calc(100vw-48px)] max-w-sm"
          >
            <TeamCard
              team={team}
              idx={idx}
              nextMatch={nextMatchByTeam[team.id]}
              activePlayoff={activePlayoffs.find((p) => p.teamId === team.id && p.rival)}
              navigate={navigate}
            />
          </div>
        ))}
      </div>
      {teams.length > 1 && (
        <div className="md:hidden flex justify-center gap-1.5 mt-1">
          {teams.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${i === activeIdx ? 'w-5 h-1.5 bg-blue-600' : 'w-1.5 h-1.5 bg-slate-300'}`}
            />
          ))}
        </div>
      )}
      <div className="hidden md:grid grid-cols-1 xl:grid-cols-2 gap-4">
        {teams.map((team, idx) => (
          <TeamCard
            key={team.id}
            team={team}
            idx={idx}
            nextMatch={nextMatchByTeam[team.id]}
            activePlayoff={activePlayoffs.find((p) => p.teamId === team.id && p.rival)}
            navigate={navigate}
          />
        ))}
      </div>
    </>
  );
}

function TodaySection({ todayEvents, teams, trainingNumbers, handleEventAction, creatingTraining, navigate }) {
  return (
    <section aria-labelledby="today-heading">
      <div className="flex items-center justify-between mb-2">
        <h2
          id="today-heading"
          className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"
        >
          <Clock size={13} aria-hidden="true" /> Hoy
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
          <CalendarDays size={28} className="mx-auto text-slate-300 mb-2" aria-hidden="true" />
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
    </section>
  );
}

function WeeklySummaryChip({ weeklySummary }) {
  if (!weeklySummary || weeklySummary.total === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2.5 flex items-center flex-wrap gap-2 text-xs text-slate-600 font-medium">
      <CalendarDays size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
      <span>Resumen:</span>
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
  );
}

function TournamentRow({ p, navigate }) {
  return (
    <button
      onClick={() => navigate(`/playoffs?teamId=${p.teamId}`)}
      className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3 hover:shadow-md transition-shadow text-left w-full"
    >
      <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
        <Trophy size={20} className="text-amber-600" aria-hidden="true" />
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
      <ChevronRight size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
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
    todayEvents,
    activePlayoffs,
    weeklySummary,
    nextMatchByTeam,
    recentExercises,
    exercisesCount,
    bibliotecaInsights,
    creatingTraining,
    handleEventAction,
    nextActionEvent,
    pendingActions,
    newsItems,
    weekStrip,
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

  const handlePendingAction = useCallback(
    (item) => {
      if (!item?.session) return;
      if (item.type === 'result' && item.session.tipo === 'playoff') {
        navigate(`/playoffs?teamId=${item.session.teamId}`);
        return;
      }
      handleEventAction(item.session);
    },
    [handleEventAction, navigate],
  );

  const handleCreateFromHero = useCallback((session) => handleEventAction(session), [handleEventAction]);

  const displayName = user?.isAnonymous ? 'Invitado' : user?.displayName || user?.email?.split('@')[0] || 'Entrenador';
  const photoURL = user?.photoURL || null;
  const initial = displayName.charAt(0).toUpperCase();
  const hora = today.getHours();
  const greeting = hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

  const pendingCount = pendingActions.length;
  const todayCount = todayEvents.length;

  const subline = (() => {
    const parts = [];
    if (pendingCount > 0)
      parts.push(`${pendingCount} ${pendingCount === 1 ? 'acción pendiente' : 'acciones pendientes'}`);
    if (todayCount > 0) parts.push(`${todayCount} ${todayCount === 1 ? 'evento' : 'eventos'} hoy`);
    if (parts.length === 0) return 'Todo al día';
    return parts.join(' · ');
  })();

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-28 overflow-x-hidden">
      {/* Header */}
      <div className="bg-gradient-to-b from-blue-950 via-blue-950 to-blue-900 px-5 pt-10 pb-32">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="min-w-0">
            <p className="text-blue-400 text-sm font-medium">{greeting}</p>
            <h1 className="text-white text-2xl font-bold leading-tight truncate">{displayName}</h1>
            <p className="text-blue-200/80 text-xs mt-0.5 truncate">{subline}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {photoURL ? (
              <img src={photoURL} alt="Avatar" className="w-9 h-9 rounded-full border-2 border-blue-700" />
            ) : (
              <div className="w-9 h-9 bg-blue-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {initial}
              </div>
            )}
            <button
              onClick={() => navigate('/settings')}
              className="text-blue-400 hover:text-white transition p-1.5 md:hidden"
              aria-label="Ajustes"
              title="Ajustes"
            >
              <Settings size={18} aria-hidden="true" />
            </button>
            <button
              onClick={handleLogout}
              className="text-blue-400 hover:text-white transition p-1.5 md:hidden"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-24">
        {/* Hero row (full width) */}
        <div className="mb-4">
          {loadingTeams && !nextActionEvent ? (
            <div className="h-36 bg-white/10 rounded-2xl animate-pulse" />
          ) : (
            <NextActionHero
              session={nextActionEvent}
              teams={teams}
              navigate={navigate}
              onCreateTraining={handleCreateFromHero}
              creating={Boolean(creatingTraining) && creatingTraining === nextActionEvent?.id}
            />
          )}
        </div>

        {/* Two-column grid on desktop, single column on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main column (left on desktop) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <TeamsSection
              teams={teams}
              loadingTeams={loadingTeams}
              nextMatchByTeam={nextMatchByTeam}
              activePlayoffs={activePlayoffs}
              navigate={navigate}
              carouselRef={carouselRef}
              cardRefs={cardRefs}
              activeIdx={activeIdx}
            />
            <TodaySection
              todayEvents={todayEvents}
              teams={teams}
              trainingNumbers={trainingNumbers}
              handleEventAction={handleEventAction}
              creatingTraining={creatingTraining}
              navigate={navigate}
            />
            <BibliotecaPreview
              exercises={recentExercises}
              totalCount={exercisesCount}
              navigate={navigate}
              insights={bibliotecaInsights}
            />
          </div>

          {/* Side column (right on desktop) */}
          <aside className="lg:col-span-1 flex flex-col gap-4">
            <PendingActionsList items={pendingActions} onAction={handlePendingAction} creatingId={creatingTraining} />
            <WeekStrip days={weekStrip} navigate={navigate} />
            <WeeklySummaryChip weeklySummary={weeklySummary} />
            {activePlayoffs.length > 0 && (
              <section aria-labelledby="tournaments-heading">
                <h2
                  id="tournaments-heading"
                  className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2"
                >
                  Torneos
                </h2>
                <div className="flex flex-col gap-2">
                  {activePlayoffs.map((p) => (
                    <TournamentRow key={p.id} p={p} navigate={navigate} />
                  ))}
                </div>
              </section>
            )}
            <NewsFeed items={newsItems} navigate={navigate} now={today} />
          </aside>
        </div>
      </div>
    </div>
  );
}
