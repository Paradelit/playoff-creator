import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X, Edit2 } from 'lucide-react';
import Dialog from '../Dialog';
import { useBracket } from '../../contexts/BracketContext';

/**
 * Bulk-edit modal for round-1 team names. Discoverable from BracketScreen's
 * overflow menu (audit P3: "Edit team names accesible desde toolbar bracket").
 * Inline edit on each MatchCard row still works; this just gives one place to
 * fix typos across the whole bracket without hunting card by card.
 */
export default function BulkEditTeamsModal({ open, onClose, bracketData }) {
  const { handleEditTeamName } = useBracket();
  const titleId = useId();
  const firstInputRef = useRef(null);

  const round1Matches = useMemo(() => {
    if (!bracketData?.state) return [];
    return Object.values(bracketData.state)
      .filter((m) => m.round === 1)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
  }, [bracketData]);

  const [edits, setEdits] = useState({});

  useEffect(() => {
    if (open) setEdits({});
  }, [open]);

  if (!open) return null;

  const setEdit = (key, value) => setEdits((prev) => ({ ...prev, [key]: value }));
  const valueFor = (key, fallback) => (key in edits ? edits[key] : fallback || '');

  const dirtyKeys = Object.keys(edits).filter((key) => {
    const [matchId, teamIndex] = key.split('::');
    const match = bracketData.state[matchId];
    if (!match) return false;
    const original = teamIndex === '1' ? match.team1 : match.team2;
    return (edits[key] || '') !== (original || '');
  });
  const dirtyCount = dirtyKeys.length;

  function applyAll() {
    dirtyKeys.forEach((key) => {
      const [matchId, teamIndex] = key.split('::');
      const newName = (edits[key] || '').trim() || null;
      handleEditTeamName(matchId, parseInt(teamIndex), newName);
    });
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4 py-6"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-pick-panel-open outline-none"
    >
      <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-slate-100">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Edit2 size={16} className="text-blue-600" aria-hidden="true" /> Editar nombres de equipos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cambia cualquier nombre de la primera ronda. Los cambios se propagan al resto del cuadro.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="text-slate-400 hover:text-slate-600 p-1 -m-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
        {round1Matches.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No hay partidos de primera ronda en este cuadro.</p>
        ) : (
          round1Matches.map((match, idx) => (
            <div key={match.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                {match.title || `Partido ${idx + 1}`}
              </p>
              <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-600">
                  <span className="block font-semibold mb-1">Equipo 1</span>
                  <input
                    ref={idx === 0 ? firstInputRef : null}
                    type="text"
                    value={valueFor(`${match.id}::1`, match.team1)}
                    onChange={(e) => setEdit(`${match.id}::1`, e.target.value)}
                    placeholder={match.team1Options?.length ? 'Sorteo…' : 'Nombre del equipo'}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  />
                </label>
                <label className="text-xs text-slate-600">
                  <span className="block font-semibold mb-1">Equipo 2</span>
                  <input
                    type="text"
                    value={valueFor(`${match.id}::2`, match.team2)}
                    onChange={(e) => setEdit(`${match.id}::2`, e.target.value)}
                    placeholder={match.team2Options?.length ? 'Sorteo…' : 'Nombre del equipo'}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  />
                </label>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {dirtyCount > 0 ? `${dirtyCount} cambio${dirtyCount === 1 ? '' : 's'} sin guardar` : 'Sin cambios'}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={applyAll}
            disabled={dirtyCount === 0}
            className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            Guardar
          </button>
        </div>
      </div>
    </Dialog>
  );
}
