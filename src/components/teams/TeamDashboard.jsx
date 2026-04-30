import React from 'react';
import { ChevronRight, ClipboardList, CalendarDays, Users, Trophy, Pencil, ShieldHalf, Trash2 } from 'lucide-react';
import { teamDisplayName } from '../../utils/teamUtils';
import { toYMD } from '../../utils/dateUtils';
import WeekStrip from './WeekStrip';

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const EVENT_STYLES = {
  partido: { icon: Trophy, iconBg: 'bg-rose-100', iconColor: 'text-rose-600', border: 'border-rose-200' },
  playoff: { icon: Trophy, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', border: 'border-amber-200' },
  entrenamiento: { icon: ClipboardList, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', border: 'border-blue-200' },
};

function nextFor(sessions, teamId, todayYMD, tipo) {
  const filtered = sessions
    .filter((s) => s.teamId === teamId && s.fecha >= todayYMD && (!tipo || s.tipo === tipo))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.horaInicio || '').localeCompare(b.horaInicio || ''));
  return filtered[0] || null;
}

function eventTitle(session) {
  if (session.tipo === 'partido') return `vs ${session.rival || 'Rival'}`;
  if (session.tipo === 'playoff') return `Torneo vs ${session.rival || 'Rival'}`;
  return 'Entrenamiento';
}

function formatEventDate(session, todayYMD) {
  if (session.fecha === todayYMD) return 'Hoy';
  const [, mm, dd] = session.fecha.split('-');
  return `${parseInt(dd, 10)} ${MONTHS_SHORT[parseInt(mm, 10) - 1]}`;
}

function NextEventCard({ session, todayYMD, navigate }) {
  const style = EVENT_STYLES[session.tipo] || EVENT_STYLES.entrenamiento;
  const Icon = style.icon;
  const dateLabel = formatEventDate(session, todayYMD);
  return (
    <button
      type="button"
      onClick={() => navigate(`/calendar?date=${session.fecha}&teamId=${session.teamId}`)}
      className={`bg-white rounded-xl border ${style.border} shadow-sm px-4 py-3 flex items-center gap-3 hover:shadow-md transition text-left w-full`}
    >
      <div className={`w-11 h-11 rounded-xl ${style.iconBg} flex items-center justify-center shrink-0`}>
        <Icon size={20} className={style.iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium">
          {dateLabel}
          {session.horaInicio ? ` · ${session.horaInicio}` : ''}
        </p>
        <p className="font-bold text-slate-800 text-sm truncate">{eventTitle(session)}</p>
        {session.lugar && <p className="text-xs text-slate-500 truncate">{session.lugar}</p>}
      </div>
      <ChevronRight size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
    </button>
  );
}

export default function TeamDashboard({
  team,
  sessions,
  activePlayoff,
  memberCounts,
  navigate,
  onEditTeam,
  onDeleteTeam,
  compact = false,
  hideTitle = false,
}) {
  const todayYMD = toYMD(new Date());
  const nextAny = nextFor(sessions, team.id, todayYMD, null);

  return (
    <div className="flex flex-col gap-4">
      {!hideTitle && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ShieldHalf size={22} className="text-blue-600 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">
                {team.categoria}
                {team.genero ? ` · ${team.genero}` : ''}
              </p>
              <h3 className="text-lg font-bold text-slate-800 truncate">{teamDisplayName(team)}</h3>
              {memberCounts && (memberCounts.jugadores > 0 || memberCounts.staff > 0) && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {memberCounts.jugadores} jugador{memberCounts.jugadores === 1 ? '' : 'es'}
                  {memberCounts.staff > 0 ? ` · ${memberCounts.staff} staff` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onEditTeam && (
              <button
                type="button"
                onClick={onEditTeam}
                title="Editar equipo"
                aria-label="Editar equipo"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
            )}
            {onDeleteTeam && (
              <button
                type="button"
                onClick={onDeleteTeam}
                title="Eliminar equipo"
                aria-label="Eliminar equipo"
                className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {nextAny ? (
        <NextEventCard session={nextAny} todayYMD={todayYMD} navigate={navigate} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-500 flex items-center justify-between gap-3">
          <span>Sin eventos próximos.</span>
          <button
            type="button"
            onClick={() => navigate(`/calendar?teamId=${team.id}`)}
            className="text-blue-600 font-bold text-xs hover:text-blue-800"
          >
            Planificar →
          </button>
        </div>
      )}

      {!compact && (
        <div className="bg-white rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Esta semana</p>
            <button
              type="button"
              onClick={() => navigate(`/calendar?teamId=${team.id}`)}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
            >
              Ver →
            </button>
          </div>
          <WeekStrip
            teamId={team.id}
            sessions={sessions}
            onDayClick={(ymd) => navigate(`/calendar?date=${ymd}&teamId=${team.id}`)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => navigate(`/teams/${team.id}`)}
          className="bg-blue-50 hover:bg-blue-100 rounded-xl p-3 text-left transition"
        >
          <div className="flex items-center gap-1.5 text-blue-700">
            <Users size={15} aria-hidden="true" />
            <span className="text-xs font-bold">Plantilla</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {memberCounts ? `${memberCounts.jugadores} jug · ${memberCounts.staff} staff` : 'Ver miembros'}
          </p>
        </button>
        <button
          type="button"
          onClick={() => navigate(`/teams/${team.id}/cuaderno`)}
          className="bg-amber-50 hover:bg-amber-100 rounded-xl p-3 text-left transition"
        >
          <div className="flex items-center gap-1.5 text-amber-700">
            <ClipboardList size={15} aria-hidden="true" />
            <span className="text-xs font-bold">Cuaderno</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">Pilares, normas…</p>
        </button>
        <button
          type="button"
          onClick={() => navigate(`/calendar?teamId=${team.id}`)}
          className="bg-slate-100 hover:bg-slate-200 rounded-xl p-3 text-left transition"
        >
          <div className="flex items-center gap-1.5 text-slate-700">
            <CalendarDays size={15} aria-hidden="true" />
            <span className="text-xs font-bold">Calendario</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">Sesiones y partidos</p>
        </button>
      </div>

      {activePlayoff && (
        <button
          type="button"
          onClick={() => navigate(`/playoffs?teamId=${team.id}`)}
          className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3 hover:shadow-md transition text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Trophy size={18} className="text-amber-600" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500">Torneo activo</p>
            <p className="font-bold text-slate-800 text-sm truncate">{activePlayoff.name}</p>
            {activePlayoff.match && activePlayoff.rival ? (
              <p className="text-xs font-bold text-blue-700 truncate">
                vs {activePlayoff.rival}
                {activePlayoff.series ? ` (${activePlayoff.series.wins}-${activePlayoff.series.losses})` : ''}
              </p>
            ) : !activePlayoff.match ? (
              <p className="text-xs text-emerald-600 font-bold">Eliminatoria finalizada</p>
            ) : (
              <p className="text-xs text-slate-400">Esperando rival...</p>
            )}
          </div>
          <ChevronRight size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
