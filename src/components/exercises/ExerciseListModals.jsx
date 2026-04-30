import React, { useId } from 'react';
import { X, Download, Upload, CheckSquare, Square, Share2, Link, Check } from 'lucide-react';
import Dialog from '../Dialog';

export function ExportModal({ exercises, exportSelected, setShowExport, toggleExportAll, toggleExportOne, doExport }) {
  const titleId = useId();
  return (
    <Dialog
      open
      onClose={() => setShowExport(false)}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200"
    >
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
        <h3 id={titleId} className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Download size={18} className="text-blue-600" aria-hidden="true" /> Exportar ejercicios
        </h3>
        <button
          type="button"
          onClick={() => setShowExport(false)}
          aria-label="Cerrar"
          className="text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="px-6 py-3 border-b border-slate-100">
        <button
          type="button"
          onClick={toggleExportAll}
          aria-pressed={exportSelected.size === exercises.length}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-600 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded"
        >
          {exportSelected.size === exercises.length ? (
            <CheckSquare size={16} className="text-blue-600" aria-hidden="true" />
          ) : (
            <Square size={16} aria-hidden="true" />
          )}
          {exportSelected.size === exercises.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
        </button>
      </div>
      <ul className="overflow-y-auto flex-1 px-6 py-2 list-none">
        {exercises.map((ex) => {
          const checked = exportSelected.has(ex.id);
          return (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => toggleExportOne(ex.id)}
                aria-pressed={checked}
                aria-label={`${checked ? 'Deseleccionar' : 'Seleccionar'} ${ex.nombre}`}
                className="w-full flex items-center gap-3 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-lg px-1 transition text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
              >
                {checked ? (
                  <CheckSquare size={16} className="text-blue-600 shrink-0" aria-hidden="true" />
                ) : (
                  <Square size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{ex.nombre}</p>
                  {(ex.tags?.length > 0 || ex.contenido) && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(ex.tags || []).map((tag, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                      {!ex.tags?.length && ex.contenido && (
                        <span className="text-xs text-blue-600 font-semibold">{ex.contenido}</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
        <button
          type="button"
          onClick={() => setShowExport(false)}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={doExport}
          disabled={exportSelected.size === 0}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-40 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          <Download size={16} aria-hidden="true" /> Exportar {exportSelected.size > 0 ? `(${exportSelected.size})` : ''}
        </button>
      </div>
    </Dialog>
  );
}

export function ImportModal({ importPreview, setImportPreview, importing, doImport }) {
  const titleId = useId();
  return (
    <Dialog
      open
      onClose={() => setImportPreview(null)}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[110] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200"
    >
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
        <h3 id={titleId} className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Upload size={18} className="text-blue-600" aria-hidden="true" /> Importar ejercicios
        </h3>
        <button
          type="button"
          onClick={() => setImportPreview(null)}
          aria-label="Cerrar"
          className="text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <p className="px-6 py-3 text-sm text-slate-500 border-b border-slate-100">
        Se añadirán{' '}
        <span className="font-bold text-slate-700">
          {importPreview.length} ejercicio{importPreview.length !== 1 ? 's' : ''}
        </span>{' '}
        a tu biblioteca. Los ejercicios existentes no se modificarán.
      </p>
      <ul className="overflow-y-auto flex-1 px-6 py-2 list-none">
        {importPreview.map((ex, i) => (
          <li key={i} className="py-3 border-b border-slate-100 last:border-0">
            <p className="font-semibold text-slate-800 text-sm">{ex.nombre || '(sin nombre)'}</p>
            {ex.contenido && <p className="text-xs text-blue-600 font-semibold mt-0.5">{ex.contenido}</p>}
            {ex.descripcion && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ex.descripcion}</p>}
          </li>
        ))}
      </ul>
      <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
        <button
          type="button"
          onClick={() => setImportPreview(null)}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={doImport}
          disabled={importing}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        >
          <Upload size={16} aria-hidden="true" /> {importing ? 'Importando...' : `Importar (${importPreview.length})`}
        </button>
      </div>
    </Dialog>
  );
}

export function ShareModal({ shareModal, setShareModal, linkCopied, copyShareLink }) {
  const titleId = useId();
  const urlId = useId();
  return (
    <Dialog
      open
      onClose={() => setShareModal(null)}
      labelledBy={titleId}
      backdropClassName="fixed inset-0 bg-slate-900/60 z-[120] flex items-end sm:items-center justify-center px-4 pt-4 pb-20 sm:pb-4 backdrop-blur-sm"
      panelClassName="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 id={titleId} className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Share2 size={18} className="text-blue-600" aria-hidden="true" /> Ejercicio compartido
        </h3>
        <button
          type="button"
          onClick={() => setShareModal(null)}
          aria-label="Cerrar"
          className="text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-4">Cualquiera con este enlace puede ver y guardar el ejercicio.</p>
      <div className="flex gap-2 mb-4">
        <label htmlFor={urlId} className="sr-only">
          Enlace para compartir
        </label>
        <input
          id={urlId}
          type="text"
          readOnly
          value={shareModal.url}
          className="flex-1 border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-slate-50 text-slate-700 truncate"
        />
        <button
          type="button"
          onClick={copyShareLink}
          aria-label={linkCopied ? 'Enlace copiado' : 'Copiar enlace'}
          className={`px-4 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${linkCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
        >
          {linkCopied ? (
            <>
              <Check size={14} aria-hidden="true" /> Copiado
            </>
          ) : (
            <>
              <Link size={14} aria-hidden="true" /> Copiar
            </>
          )}
        </button>
      </div>
      <div className="flex justify-center">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shareModal.url)}&size=180x180&margin=8`}
          alt="Código QR del enlace compartido"
          className="w-44 h-44 rounded-lg border border-slate-200"
        />
      </div>
    </Dialog>
  );
}
