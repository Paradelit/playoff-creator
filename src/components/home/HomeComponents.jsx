import React from 'react';
import { Trophy, ClipboardList, Plus, FolderOpen, ArrowRight, History, Swords, Search, BarChart3 } from 'lucide-react';
import { teamDisplayName } from '../../utils/teamUtils';
import { isMinibasketSextos } from '../../utils/minibasketUtils';
import { toYMD } from '../../utils/dateUtils';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export { MONTHS };

export function EmptyTeamCard({ navigate }) {
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

export function MatchDayWidget({ session, teams, todayYMD, navigate }) {
  const team = teams.find((t) => t.id === session.teamId);
  const isToday = session.fecha === todayYMD;
  const isFuture = session.fecha >= todayYMD;

  let timeLabel = isToday ? 'Hoy' : 'Mañana';
  if (isToday && session.horaInicio) {
    const [h, m] = session.horaInicio.split(':').map(Number);
    const now = new Date();
    const matchTime = new Date();
    matchTime.setHours(h, m, 0, 0);
    const diffMs = matchTime - now;
    if (diffMs > 0) {
      const diffH = Math.floor(diffMs / 3600000);
      const diffM = Math.floor((diffMs % 3600000) / 60000);
      timeLabel = diffH > 0 ? `En ${diffH}h ${diffM}m` : `En ${diffM} min`;
    } else {
      timeLabel = 'En curso';
    }
  }

  const actionRoute = isFuture ? `/calendar/${session.id}/scouting` : `/calendar/${session.id}/analysis`;
  const actionLabel = isFuture ? 'Scouting' : 'Análisis';
  const ActionIcon = isFuture ? Search : BarChart3;

  return (
    <div className="mt-4 bg-gradient-to-r from-rose-500 to-rose-600 rounded-2xl p-4 text-white shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <Swords size={16} className="text-rose-200" />
        <span className="text-xs font-bold uppercase tracking-wider text-rose-200">Día de partido</span>
        <span className="ml-auto text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">{timeLabel}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-bold text-lg truncate">
            vs {session.rival || 'Rival'} {session.esLocal ? '(Local)' : '(Visitante)'}
          </p>
          <p className="text-rose-100 text-xs truncate">
            {team ? teamDisplayName(team) : ''}
            {session.horaInicio ? ` · ${session.horaInicio}` : ''}
            {session.lugar ? ` · ${session.lugar}` : ''}
          </p>
        </div>
        <button
          onClick={() => navigate(actionRoute)}
          className="shrink-0 bg-white/20 hover:bg-white/30 text-white font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition ml-3"
        >
          <ActionIcon size={14} />
          {actionLabel}
        </button>
      </div>
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

export function ActionEventRow({ session, onAction, creating, teams, variant, trainingNumbers }) {
  const { bg, color } = getEventIcon(session);
  const actionLabel = getActionLabel(session, teams);

  const actionColors = {
    playoff: 'bg-amber-500 hover:bg-amber-600',
    partido: 'bg-rose-500 hover:bg-rose-600',
    entrenamiento: 'bg-blue-600 hover:bg-blue-700',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3 w-full">
      <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${bg}`}>
        <span className={`text-xs font-bold uppercase ${color}`}>
          {session.fecha ? MONTHS[parseInt(session.fecha.split('-')[1]) - 1] : ''}
        </span>
        <span className={`text-lg font-black leading-none ${color}`}>
          {session.fecha ? parseInt(session.fecha.split('-')[2]) : ''}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 text-sm truncate">
          {session.tipo === 'playoff'
            ? `${session.bracketName} · ${session.matchTitle}`
            : session.tipo === 'partido'
              ? `vs ${session.rival || 'Rival'} ${session.esLocal ? '(L)' : '(V)'}`
              : `Entrenamiento #${trainingNumbers.get(session.id) || session.sessionNumber}`}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {session.teamName}
          {session.horaInicio ? ` · ${session.horaInicio}` : ''}
          {session.lugar ? ` · ${session.lugar}` : ''}
        </p>
      </div>
      <button
        onClick={onAction}
        disabled={creating}
        className={`shrink-0 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${actionColors[session.tipo] || 'bg-slate-600 hover:bg-slate-700'} disabled:opacity-60`}
      >
        {creating ? (
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
