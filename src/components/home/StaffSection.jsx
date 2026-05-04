import React from 'react';
import { Users } from 'lucide-react';

/**
 * Sub-4: bloque de "Staff del club" en el HomeScreen para callers que sean
 * DT (owner o role='dt') en workspaces de tipo club. Los coaches no lo ven —
 * su HomeScreen sigue igual que en personal. Listado compacto con role badge
 * y count de equipos asignados, link al MembersScreen para gestión completa.
 */
export default function StaffSection({ members, currentUid, ownerUid, navigate }) {
  if (!Array.isArray(members) || members.length === 0) return null;

  // Orden: owner primero, luego DTs, luego coaches. Dentro de cada grupo,
  // alfabético por displayName/email para estabilidad visual.
  const sorted = [...members].sort((a, b) => {
    const rank = (m) => {
      if (m.uid === ownerUid) return 0;
      if (m.role === 'dt') return 1;
      return 2;
    };
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '');
  });

  return (
    <section aria-labelledby="staff-heading">
      <div className="flex items-center justify-between mb-2">
        <h2
          id="staff-heading"
          className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"
        >
          <Users size={13} aria-hidden="true" /> Staff ({members.length})
        </h2>
        <button
          onClick={() => navigate('/area-privada/settings/miembros')}
          className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
        >
          Gestionar →
        </button>
      </div>
      <ul className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
        {sorted.map((m) => {
          const isOwner = m.uid === ownerUid;
          const isMe = m.uid === currentUid;
          const teamsCount = Array.isArray(m.assignedTeamIds) ? m.assignedTeamIds.length : 0;
          const initial = (m.displayName || m.email || '?').charAt(0).toUpperCase();
          return (
            <li key={m.uid} className="px-4 py-2.5 flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {m.displayName || m.email || '(sin nombre)'}
                  {isMe && <span className="text-xs text-slate-400 font-normal"> · tú</span>}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isOwner ? (
                    <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                      Propietario
                    </span>
                  ) : m.role === 'dt' ? (
                    <span className="text-[10px] uppercase tracking-wide bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                      DT
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                      Coach
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
                    {teamsCount} {teamsCount === 1 ? 'equipo' : 'equipos'}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
