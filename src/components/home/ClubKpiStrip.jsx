import React, { useMemo } from 'react';
import { ClipboardList, Trophy, Users, ShieldHalf } from 'lucide-react';

/**
 * Sub-4 slice 4: tira de KPIs club-wide para DTs en HomeScreen del club.
 * Muestra cuatro métricas compactas calculadas de los datos ya en memoria
 * (no nuevas suscripciones): teams visibles del caller, sesiones de la
 * semana actual, partidos próximos, torneos activos.
 *
 * Para coaches o personal workspace: el caller no ve este componente
 * (se gateaba en HomeScreen).
 */
export default function ClubKpiStrip({ teams, allSessions, activePlayoffs, members }) {
  const stats = useMemo(() => {
    const today = new Date();
    const startOfWeek = new Date(today);
    const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
    startOfWeek.setDate(today.getDate() - dow);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const weekSessions = (allSessions || []).filter((s) => {
      if (!s.fecha) return false;
      const d = new Date(s.fecha);
      return d >= startOfWeek && d < endOfWeek;
    });
    const weekTrainings = weekSessions.filter((s) => s.tipo === 'entrenamiento').length;

    // Partidos próximos: a partir de hoy, próximos 14 días.
    const horizon = new Date(today);
    horizon.setDate(today.getDate() + 14);
    horizon.setHours(0, 0, 0, 0);
    const startToday = new Date(today);
    startToday.setHours(0, 0, 0, 0);
    const upcomingMatches = (allSessions || []).filter((s) => {
      if (s.tipo !== 'partido' || !s.fecha) return false;
      const d = new Date(s.fecha);
      return d >= startToday && d < horizon;
    }).length;

    return {
      teamsCount: (teams || []).length,
      weekTrainings,
      upcomingMatches,
      activeTournaments: (activePlayoffs || []).length,
      staffCount: (members || []).length,
    };
  }, [teams, allSessions, activePlayoffs, members]);

  if (stats.teamsCount === 0 && stats.staffCount === 0) return null;

  const items = [
    { icon: ShieldHalf, label: 'Equipos', value: stats.teamsCount, color: 'text-blue-600 bg-blue-50' },
    {
      icon: ClipboardList,
      label: 'Entrenos esta semana',
      value: stats.weekTrainings,
      color: 'text-emerald-600 bg-emerald-50',
    },
    { icon: Trophy, label: 'Partidos en 14 días', value: stats.upcomingMatches, color: 'text-rose-600 bg-rose-50' },
    { icon: Users, label: 'Staff', value: stats.staffCount, color: 'text-slate-700 bg-slate-100' },
  ];

  return (
    <section aria-label="Resumen del club" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div
            key={it.label}
            className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2.5 flex items-center gap-2.5"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${it.color}`}>
              <Icon size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold truncate">{it.label}</p>
              <p className="text-lg font-bold text-slate-800 leading-tight">{it.value}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
