import React from 'react';
import { BookOpen, X } from 'lucide-react';
import CourtCanvas from '../CourtCanvas';

export default function LibraryPanel({
  libraryPanel,
  setLibraryPanel,
  librarySearch,
  setLibrarySearch,
  libraryFilterTags,
  setLibraryFilterTags,
  libraryAllTags,
  libraryFiltered,
  loadFromLibrary,
}) {
  return (
    <div
      className="fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:h-full sm:w-[350px] z-[105] print:hidden flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Backdrop mobile only */}
      <div
        className="fixed inset-0 bg-slate-900/50 sm:hidden"
        onClick={() => setLibraryPanel({ open: false, targetId: null })}
      />
      <div className="relative z-10 bg-white h-full w-full sm:shadow-2xl sm:border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <BookOpen size={16} className="text-blue-600" /> Biblioteca
          </h3>
          <button
            onClick={() => setLibraryPanel({ open: false, targetId: null })}
            aria-label="Cerrar"
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-slate-100 space-y-2">
          <input
            type="text"
            placeholder="Buscar..."
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {libraryAllTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {libraryAllTags.map((tag) => {
                const active = libraryFilterTags.map((t) => t.toLowerCase()).includes(tag.toLowerCase());
                return (
                  <button
                    key={tag}
                    onClick={() =>
                      setLibraryFilterTags((prev) =>
                        active ? prev.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...prev, tag],
                      )
                    }
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {libraryPanel.targetId && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 font-medium">
            Selecciona un ejercicio para cargarlo en la fila resaltada
          </div>
        )}
        <div className="overflow-y-auto flex-1">
          {libraryFiltered.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-12">No hay ejercicios en la biblioteca.</p>
          ) : (
            libraryFiltered.map((ex) => (
              <button
                key={ex.id}
                onClick={() => {
                  if (libraryPanel.targetId) {
                    loadFromLibrary(libraryPanel.targetId, ex);
                  }
                }}
                disabled={!libraryPanel.targetId}
                className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-blue-50 transition-colors disabled:opacity-50 flex gap-3 items-start"
              >
                {(ex.elementos?.length > 0 || ex.tipoPista) && (
                  <div className="w-16 h-12 shrink-0 bg-gray-50 rounded border border-slate-200 flex items-center justify-center overflow-hidden">
                    <CourtCanvas tipo={ex.tipoPista || 'media'} elementos={ex.elementos || []} readOnly={true} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 text-sm truncate">{ex.nombre}</p>
                  {(ex.tags?.length > 0 || ex.contenido) && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(ex.tags || []).map((tag, i) => (
                        <span
                          key={i}
                          className="text-[9px] bg-indigo-100 text-indigo-600 font-semibold px-1.5 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                      {!ex.tags?.length && ex.contenido && (
                        <span className="text-xs text-indigo-500 font-semibold">{ex.contenido}</span>
                      )}
                    </div>
                  )}
                  {ex.descripcion && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ex.descripcion}</p>}
                </div>
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-100">
          <button
            onClick={() => setLibraryPanel({ open: false, targetId: null })}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
