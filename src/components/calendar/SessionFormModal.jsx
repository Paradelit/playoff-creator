import React from 'react';
import { X, ClipboardList, Trophy, MapPin, ArrowRight } from 'lucide-react';
import { teamDisplayName } from '../../utils/teamUtils';
import { FormField } from './CalendarHelpers';

const isPlayoffSession = (s) => s?.tipo === 'playoff';

export default function SessionFormModal({
  editingSession,
  setEditingSession,
  teams,
  filterTeam,
  filterTeamId,
  sessionErrors,
  setSessionErrors,
  savingSession,
  getTrainingNum,
  onSubmit,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-2 pb-20 sm:pb-4 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100vh-5.5rem)] sm:max-h-[92vh] overflow-y-auto overflow-x-hidden animate-in zoom-in-95 duration-200 my-auto shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="text-lg font-bold text-slate-800">
            {isPlayoffSession(editingSession)
              ? 'Editar horario del cruce'
              : editingSession.id
                ? 'Editar sesión'
                : 'Nueva sesión'}
          </h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="px-5 py-4 flex flex-col gap-4">
          {isPlayoffSession(editingSession) ? (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <Trophy size={18} className="text-amber-600 shrink-0" />
              <div className="min-w-0 text-xs text-amber-800">
                <p className="font-bold truncate">{editingSession.bracketName || 'Torneo'}</p>
                <p className="truncate">
                  {editingSession.matchTitle || ''}
                  {editingSession.gamesCount > 1 ? ` · Partido ${Number(editingSession.gameIndex || 0) + 1}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <FormField label="Tipo de sesión">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSession((s) => ({ ...s, tipo: 'entrenamiento' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${editingSession.tipo === 'entrenamiento' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <ClipboardList size={15} /> Entrenamiento
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSession((s) => ({ ...s, tipo: 'partido' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${editingSession.tipo === 'partido' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  <Trophy size={15} /> Partido
                </button>
              </div>
            </FormField>
          )}

          <FormField label="Equipo" error={sessionErrors.teamId}>
            {isPlayoffSession(editingSession) ? (
              <div className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-700 font-medium">
                {editingSession.teamName || '—'}
              </div>
            ) : filterTeamId && filterTeam ? (
              <div className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-700 font-medium">
                {teamDisplayName(filterTeam)}
              </div>
            ) : (
              <select
                value={editingSession.teamId}
                onChange={(e) => {
                  setEditingSession((s) => ({ ...s, teamId: e.target.value }));
                  if (sessionErrors.teamId) setSessionErrors((prev) => ({ ...prev, teamId: undefined }));
                }}
                required
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white ${sessionErrors.teamId ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-blue-400'}`}
              >
                <option value="">Selecciona un equipo</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {teamDisplayName(t)}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          {isPlayoffSession(editingSession) && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Rival">
                <div className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-700 font-medium truncate">
                  {editingSession.rival || '—'}
                </div>
              </FormField>
              <FormField label="Campo">
                <div className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-700 font-medium">
                  {editingSession.esLocal ? 'Local' : 'Visitante'}
                </div>
              </FormField>
            </div>
          )}

          {editingSession.tipo === 'partido' && (
            <>
              <FormField label="Rival">
                <input
                  type="text"
                  placeholder="Nombre del equipo rival..."
                  value={editingSession.rival || ''}
                  onChange={(e) => setEditingSession((s) => ({ ...s, rival: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </FormField>
              <FormField label="Campo">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSession((s) => ({ ...s, esLocal: true }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 ${editingSession.esLocal ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <MapPin size={14} /> Local
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSession((s) => ({ ...s, esLocal: false }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 ${!editingSession.esLocal ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    <ArrowRight size={14} /> Visitante
                  </button>
                </div>
              </FormField>
              <FormField label="Convocatoria (opcional)">
                <textarea
                  placeholder="Nombres de los jugadores convocados..."
                  value={editingSession.convocatoria || ''}
                  onChange={(e) => setEditingSession((s) => ({ ...s, convocatoria: e.target.value }))}
                  rows={2}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </FormField>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Fecha" error={sessionErrors.fecha}>
              <input
                type="date"
                required
                value={editingSession.fecha}
                onChange={(e) => {
                  setEditingSession((s) => ({ ...s, fecha: e.target.value }));
                  if (sessionErrors.fecha) setSessionErrors((prev) => ({ ...prev, fecha: undefined }));
                }}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${sessionErrors.fecha ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-blue-400'}`}
              />
            </FormField>
            {editingSession.tipo === 'entrenamiento' && editingSession.id && (
              <FormField label="Nº sesión">
                <p className="px-3 py-2.5 text-sm text-slate-600 bg-slate-50 rounded-xl border border-slate-200">
                  {getTrainingNum(editingSession) || '—'}
                  <span className="text-xs text-slate-400 ml-2">(automático por fecha)</span>
                </p>
              </FormField>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Hora inicio">
              <input
                type="time"
                value={editingSession.horaInicio}
                onChange={(e) => setEditingSession((s) => ({ ...s, horaInicio: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </FormField>
            <FormField label="Hora fin" error={sessionErrors.horaFin}>
              <input
                type="time"
                value={editingSession.horaFin}
                onChange={(e) => {
                  setEditingSession((s) => ({ ...s, horaFin: e.target.value }));
                  if (sessionErrors.horaFin) setSessionErrors((prev) => ({ ...prev, horaFin: undefined }));
                }}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${sessionErrors.horaFin ? 'border-red-400 focus:ring-red-300' : 'border-slate-300 focus:ring-blue-400'}`}
              />
            </FormField>
          </div>
          <FormField label="Lugar">
            <input
              type="text"
              placeholder="Pabellón, pista..."
              value={editingSession.lugar}
              onChange={(e) => setEditingSession((s) => ({ ...s, lugar: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </FormField>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingSession}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60"
            >
              {savingSession ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
