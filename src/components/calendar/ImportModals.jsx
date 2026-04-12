import React from 'react';
import { X, Upload, Sparkles, AlertTriangle } from 'lucide-react';
import { teamDisplayName } from '../../utils/teamUtils';
import { formatDateDisplay } from '../../utils/dateUtils';
import { DAY_NAMES_FULL } from '../../utils/constants';

export function ImportSetupModal({ importSetup, setImportSetup, fileInputRef }) {
  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
      onClick={() => setImportSetup(null)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sparkles size={18} className="text-orange-300" /> Importar cuadrante con IA
            </h3>
            <button
              onClick={() => setImportSetup(null)}
              aria-label="Cerrar"
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-slate-500">
            La IA detectará los horarios de tus equipos en el Excel y generará todos los eventos del calendario
            automáticamente.
          </p>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Generar eventos desde</label>
            <input
              type="date"
              value={importSetup.startDate}
              onChange={(e) => setImportSetup((s) => ({ ...s, startDate: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Hasta</label>
            <input
              type="date"
              value={importSetup.endDate}
              onChange={(e) => setImportSetup((s) => ({ ...s, endDate: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!importSetup.startDate || !importSetup.endDate}
            className="w-full bg-gradient-to-r from-orange-500 to-blue-700 hover:from-orange-600 hover:to-blue-800 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition text-sm mt-1"
          >
            <Upload size={16} /> Seleccionar archivo Excel
          </button>
        </div>
      </div>
    </div>
  );
}

export function ImportPreviewModal({
  importing,
  importPreview,
  importError,
  bulkSaving,
  teams,
  setImportPreview,
  setImportError,
  onRequestImport,
  expandRecurring,
}) {
  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-2 pb-20 sm:pb-4 backdrop-blur-sm overflow-y-auto"
      onClick={() => {
        if (!importing && !bulkSaving) {
          setImportPreview(null);
          setImportError('');
        }
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[calc(100vh-5.5rem)] sm:max-h-[88vh] flex flex-col animate-in zoom-in-95 duration-200 my-auto shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Sparkles size={18} className="text-orange-300" /> Importar con IA
          </h3>
          {!importing && !bulkSaving && (
            <button
              onClick={() => {
                setImportPreview(null);
                setImportError('');
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {importing && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-600 text-sm text-center">Procesando...</p>
            </div>
          )}
          {importError && !importing && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{importError}</div>
          )}
          {importPreview && !importing && (
            <ImportPreviewContent
              importPreview={importPreview}
              teams={teams}
              setImportPreview={setImportPreview}
              expandRecurring={expandRecurring}
            />
          )}
        </div>
        {importPreview && !importing && (
          <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex gap-3">
            <button
              onClick={() => {
                setImportPreview(null);
                setImportError('');
              }}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={onRequestImport}
              disabled={bulkSaving}
              className="flex-1 bg-gradient-to-r from-orange-500 to-blue-700 hover:from-orange-600 hover:to-blue-800 text-white font-bold py-3 rounded-xl transition disabled:opacity-60 text-sm flex items-center justify-center gap-2"
            >
              {bulkSaving ? (
                'Creando eventos...'
              ) : (
                <>
                  <Sparkles size={15} /> Generar eventos
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportPreviewContent({ importPreview, teams, setImportPreview, expandRecurring }) {
  const { recurring, specific, startDate, endDate } = importPreview;
  const expandedCount = expandRecurring(recurring, startDate, endDate).length;
  const totalCount = expandedCount + specific.filter((s) => s._teamId).length;

  return (
    <>
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-4 text-sm text-orange-800">
        <span className="font-bold">{totalCount} eventos</span> a crear entre{' '}
        <span className="font-bold">{formatDateDisplay(startDate)}</span> y{' '}
        <span className="font-bold">{formatDateDisplay(endDate)}</span>
      </div>

      {recurring.length > 0 && (
        <div className="mb-5">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Horarios recurrentes ({recurring.length} patrones)
          </h4>
          <div className="flex flex-col gap-2">
            {recurring.map((p, i) => {
              const weekCount = expandRecurring([p], startDate, endDate).length;
              return (
                <div key={i} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200">
                  <div className="mb-1.5">
                    <select
                      value={p._teamId}
                      onChange={(e) =>
                        setImportPreview((prev) => ({
                          ...prev,
                          recurring: prev.recurring.map((r, ri) => (ri === i ? { ...r, _teamId: e.target.value } : r)),
                        }))
                      }
                      className="border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-full"
                    >
                      <option value="">Sin asignar</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {teamDisplayName(t)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-700">{DAY_NAMES_FULL[p.diaSemana]}</span>
                    <span className="text-xs text-slate-500">
                      {p.horaInicio}
                      {p.horaFin ? `–${p.horaFin}` : ''}
                    </span>
                    {p.lugar && <span className="text-xs text-slate-400 truncate">{p.lugar}</span>}
                    <span className="text-xs font-bold text-blue-600 ml-auto">×{weekCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {specific.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Fechas especiales ({specific.length})
          </h4>
          <div className="flex flex-col gap-2">
            {specific.map((s, i) => (
              <div key={i} className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200">
                <div className="mb-1.5">
                  <select
                    value={s._teamId}
                    onChange={(e) =>
                      setImportPreview((prev) => ({
                        ...prev,
                        specific: prev.specific.map((r, ri) => (ri === i ? { ...r, _teamId: e.target.value } : r)),
                      }))
                    }
                    className="border border-slate-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-full"
                  >
                    <option value="">Sin asignar</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {teamDisplayName(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-semibold ${s.tipo === 'partido' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}
                  >
                    {s.tipo === 'partido' ? 'Partido' : 'Entreno'}
                  </span>
                  <span className="text-xs text-slate-700">{formatDateDisplay(s.fecha)}</span>
                  <span className="text-xs text-slate-500">
                    {s.horaInicio && s.horaFin ? `${s.horaInicio}–${s.horaFin}` : s.horaInicio || '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function DuplicateConflictModal({ duplicateConflict, importPreview, bulkSaving, onImport, onCancel }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Eventos existentes</h3>
            <p className="text-xs text-slate-500">
              Se encontraron {duplicateConflict.count} eventos para estos equipos en el mismo rango de fechas.
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-5">¿Qué quieres hacer con los eventos existentes?</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() =>
              onImport(
                duplicateConflict.toImport,
                true,
                duplicateConflict.teamIds,
                importPreview.startDate,
                importPreview.endDate,
              )
            }
            disabled={bulkSaving}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl transition disabled:opacity-60 text-sm"
          >
            {bulkSaving ? 'Procesando...' : `Reemplazar (eliminar ${duplicateConflict.count} eventos anteriores)`}
          </button>
          <button
            onClick={() =>
              onImport(
                duplicateConflict.toImport,
                false,
                duplicateConflict.teamIds,
                importPreview.startDate,
                importPreview.endDate,
              )
            }
            disabled={bulkSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition disabled:opacity-60 text-sm"
          >
            Añadir de todas formas
          </button>
          <button
            onClick={onCancel}
            disabled={bulkSaving}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
