import React, { useEffect, useState } from 'react';
import { Swords, ClipboardList, Trophy, MapPin, Clock, ArrowRight, Search, BarChart3 } from 'lucide-react';
import { teamDisplayName } from '../../utils/teamUtils';
import { isMinibasketSextos } from '../../utils/minibasketUtils';
import { formatCountdown } from '../../utils/homeUtils';

const TYPE_STYLES = {
  partido: {
    gradient: 'from-rose-500 to-rose-600',
    accent: 'text-rose-100',
    badge: 'text-rose-200',
    Icon: Swords,
    kindLabel: 'Día de partido',
  },
  entrenamiento: {
    gradient: 'from-blue-600 to-blue-800',
    accent: 'text-blue-100',
    badge: 'text-blue-200',
    Icon: ClipboardList,
    kindLabel: 'Próximo entrenamiento',
  },
  playoff: {
    gradient: 'from-amber-500 to-amber-700',
    accent: 'text-amber-100',
    badge: 'text-amber-100',
    Icon: Trophy,
    kindLabel: 'Eliminatoria',
  },
};

function primaryAction(session, teams) {
  if (!session) return null;
  if (session.tipo === 'partido') {
    const team = teams.find((t) => t.id === session.teamId);
    if (isMinibasketSextos(team)) {
      return { label: 'Planilla', Icon: ClipboardList, route: `/calendar/${session.id}/planilla`, state: undefined };
    }
    const isPast = session.fecha < new Date().toISOString().slice(0, 10);
    return isPast
      ? { label: 'Análisis', Icon: BarChart3, route: `/calendar/${session.id}/analysis` }
      : { label: 'Scouting', Icon: Search, route: `/calendar/${session.id}/scouting` };
  }
  if (session.tipo === 'entrenamiento') {
    if (session.trainingId) {
      return {
        label: 'Abrir entrenamiento',
        Icon: ArrowRight,
        route: `/teams/${session.teamId}/trainings/${session.trainingId}`,
      };
    }
    return { label: 'Crear entrenamiento', Icon: ClipboardList, route: null, triggersCreate: true };
  }
  if (session.tipo === 'playoff') {
    return { label: 'Ver torneo', Icon: Trophy, route: `/playoffs?teamId=${session.teamId}` };
  }
  return null;
}

function titleFor(session) {
  if (!session) return '';
  if (session.tipo === 'partido') {
    return `vs ${session.rival || 'Rival'}${session.esLocal ? ' (L)' : ' (V)'}`;
  }
  if (session.tipo === 'playoff') {
    return session.matchTitle
      ? `${session.matchTitle} · vs ${session.rival || 'Rival'}`
      : `vs ${session.rival || 'Rival'}`;
  }
  return 'Entrenamiento';
}

export default function NextActionHero({ session, teams, navigate, onCreateTraining, creating }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!session) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
          <ClipboardList size={22} className="text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-800">Todo al día</p>
          <p className="text-xs text-slate-500">Sin acciones inmediatas en los próximos días.</p>
        </div>
      </div>
    );
  }

  const styles = TYPE_STYLES[session.tipo] || TYPE_STYLES.entrenamiento;
  const { Icon } = styles;
  const { label: countdown, urgency } = formatCountdown(session, now);
  const team = teams?.find((t) => t.id === session.teamId);
  const action = primaryAction(session, teams || []);
  const badgeBg = urgency === 'live' ? 'bg-white text-slate-900' : urgency === 'soon' ? 'bg-white/30' : 'bg-white/20';

  function handleAction() {
    if (!action) return;
    if (action.triggersCreate) onCreateTraining?.(session);
    else if (action.route) navigate(action.route, action.state ? { state: action.state } : undefined);
  }

  return (
    <div className={`bg-gradient-to-r ${styles.gradient} rounded-2xl p-5 text-white shadow-lg`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className={styles.badge} />
        <span className={`text-xs font-bold uppercase tracking-wider ${styles.badge}`}>{styles.kindLabel}</span>
        {countdown && (
          <span className={`ml-auto text-xs font-bold ${badgeBg} px-2.5 py-0.5 rounded-full`}>{countdown}</span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-xl leading-tight truncate">{titleFor(session)}</p>
          <p className={`${styles.accent} text-sm mt-1 truncate`}>
            {team ? teamDisplayName(team) : session.teamName || ''}
          </p>
          <div className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs ${styles.accent}`}>
            {session.horaInicio && (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {session.horaInicio}
                {session.horaFin ? `–${session.horaFin}` : ''}
              </span>
            )}
            {session.lugar && (
              <span className="inline-flex items-center gap-1 truncate max-w-[12rem]">
                <MapPin size={12} /> {session.lugar}
              </span>
            )}
          </div>
        </div>
        {action && (
          <button
            onClick={handleAction}
            disabled={creating}
            className="shrink-0 bg-white/20 hover:bg-white/30 active:bg-white/40 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition disabled:opacity-60"
          >
            {creating ? (
              '...'
            ) : (
              <>
                <action.Icon size={14} />
                {action.label}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
