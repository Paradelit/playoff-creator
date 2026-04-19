import React from 'react';
import { BookOpen, Plus, Download, Upload } from 'lucide-react';

export default function LibraryHeader({ exerciseCount, importRef, onImport, onExport, onCreate, showExport }) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
          <BookOpen className="text-amber-500 shrink-0" size={30} /> Biblioteca
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          {exerciseCount > 0
            ? `${exerciseCount} ejercicio${exerciseCount === 1 ? '' : 's'} reutilizable${exerciseCount === 1 ? '' : 's'}`
            : 'Ejercicios reutilizables para tus entrenamientos.'}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={onImport} />
        <button
          onClick={() => importRef.current?.click()}
          className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition"
        >
          <Upload size={16} /> Importar
        </button>
        {showExport && (
          <button
            onClick={onExport}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition"
          >
            <Download size={16} /> Exportar
          </button>
        )}
        <button
          onClick={onCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition text-sm sm:text-base"
        >
          <Plus size={18} /> <span className="hidden xs:inline">Nuevo</span> ejercicio
        </button>
      </div>
    </div>
  );
}
