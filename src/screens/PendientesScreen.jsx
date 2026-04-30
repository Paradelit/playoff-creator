import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useHomeDashboard } from '../hooks/useHomeDashboard';
import { useCompetitions } from '../hooks/useCompetitions';
import PendingActionsList from '../components/home/PendingActionsList';
import { buildAllPendientes } from '../utils/homeUtils';
import ConvocatoriaModal from '../components/calendar/ConvocatoriaModal';
import CumpleañosModal from '../components/home/CumpleañosModal';

const FILTERS = [
  ['all', 'Todo'],
  ['convocatoria', 'Convocatorias'],
  ['cumpleaños', 'Cumpleaños'],
  ['result', 'Resultados'],
];

export default function PendientesScreen() {
  const navigate = useNavigate();
  const { teams, allSessions, allMembers, today, todayYMD, creatingTraining, handleEventAction } = useHomeDashboard();
  const [filterType, setFilterType] = useState('all');
  const [filterTeam, setFilterTeam] = useState('all');
  const [convocatoriaSession, setConvocatoriaSession] = useState(null);
  const [cumpleañosItem, setCumpleañosItem] = useState(null);

  const allItems = useMemo(
    () =>
      buildAllPendientes({
        sessions: allSessions,
        teams,
        members: allMembers,
        todayYMD,
        now: today,
        limit: 9999,
      }),
    [allSessions, teams, allMembers, todayYMD, today],
  );

  const filtered = useMemo(
    () =>
      allItems.filter((i) => {
        if (filterType !== 'all' && i.type !== filterType) return false;
        if (filterTeam !== 'all') {
          const itemTeamId = i.team?.id || i.session?.teamId;
          if (itemTeamId !== filterTeam) return false;
        }
        return true;
      }),
    [allItems, filterType, filterTeam],
  );

  function handleAction(item) {
    if (item?.type === 'convocatoria' && item.session) {
      setConvocatoriaSession(item.session);
      return;
    }
    if (item?.type === 'cumpleaños') {
      setCumpleañosItem(item);
      return;
    }
    if (!item?.session) return;
    if (item.type === 'result' && item.session.tipo === 'playoff') {
      navigate(`/area-privada/playoffs?teamId=${item.session.teamId}`);
      return;
    }
    handleEventAction(item.session);
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 sm:px-6 py-6 sm:py-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-sm font-bold mb-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Volver
        </button>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mb-1">Pendientes</h1>
        <p className="text-sm text-slate-500 mb-5">
          {allItems.length === 0
            ? 'Cancha despejada. Vuelve mañana.'
            : `${allItems.length} ${allItems.length === 1 ? 'tarea' : 'tareas'} en cola.`}
        </p>

        {/* Filter row: type chips on top (always horizontal), team filter on its own
            row on mobile so labels don't overlap the dropdown */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilterType(v)}
                aria-pressed={filterType === v}
                className={`text-xs font-bold px-3 py-1.5 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${
                  filterType === v
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {teams.length > 1 && (
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
              aria-label="Filtrar por equipo"
              className={`text-xs font-bold px-3 py-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors ${
                filterTeam === 'all'
                  ? 'bg-white border border-slate-200 text-slate-600'
                  : 'bg-blue-50 border border-blue-300 text-blue-700'
              }`}
            >
              <option value="all">Todos los equipos</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.teamName || t.id}
                </option>
              ))}
            </select>
          )}
        </div>

        {allItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 px-6 py-10 text-center flex flex-col items-center gap-3">
            <CheckCircle2 size={36} className="text-emerald-500" aria-hidden="true" />
            <div>
              <p className="text-base font-bold text-slate-700">Cancha despejada</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Cuando tengas convocatorias, resultados o cumpleaños por gestionar, aparecerán aquí.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/area-privada/calendar')}
              className="text-sm font-bold text-blue-600 hover:text-blue-800 transition"
            >
              Ver calendario →
            </button>
          </div>
        ) : (
          <PendingActionsList
            items={filtered}
            total={filtered.length}
            onAction={handleAction}
            creatingId={creatingTraining}
            overflowHref={null}
          />
        )}
      </div>

      {convocatoriaSession && (
        <ConvocatoriaModalWrapper
          session={convocatoriaSession}
          teams={teams}
          onClose={() => setConvocatoriaSession(null)}
        />
      )}
      {cumpleañosItem && <CumpleañosModal item={cumpleañosItem} onClose={() => setCumpleañosItem(null)} />}
    </div>
  );
}

function ConvocatoriaModalWrapper({ session, teams, onClose }) {
  const { competitions } = useCompetitions(session.teamId);
  const team = (teams || []).find((t) => t.id === session.teamId) || null;
  const competition = (competitions || []).find((c) => c.id === session.competitionId) || null;
  return <ConvocatoriaModal session={session} team={team} competition={competition} onClose={onClose} />;
}
